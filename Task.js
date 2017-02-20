// Base class for creep tasks. Refactors creep_goTask implementation and is designed to be more extensible
var Task = function (taskName) {
    /** @param {Creep} creep **/
    // Parameters for the task
    this.name = taskName; // name of task
    this.creepName = null; // name of creep assigned to task
    this.targetID = null; // id or name of target task is aimed at
    this.maxPerTarget = Infinity; // maximum number of creeps that can be assigned to a given target
    this.maxPerTask = Infinity; // maximum number of creeps that can be doing this task at once
    this.targetRange = 1; // range you need to be at to execute the task
    this.moveColor = '#fff';
    // Assign the task to a creep
    this.assign = function (creep, target = null) {
        // register references to creep and target
        this.creep = creep;
        this.target = target;
        creep.memory.task = this;
        this.onAssignment()
    };
    // Action to do on assignment
    this.onAssignment = function () {
        // override if needed
        var creep = this.creep;
        creep.log(" assigned to " + this.name + " " + this.target + ".");
        creep.say(this.name);
    };
    // Test every tick to see if task is still valid
    this.isValidTask = function () { // needs to be overwritten in task instance
        return true;
    };
    // Test every tick to see if target is still valid
    this.isValidTarget = function () { // needs to be overwritten in task instance
        return (this.target != null);
    };
    // Execute this task each tick. Returns nothing unless work is done.
    this.step = function () {
        var creep = this.creep;
        var target = this.target;
        if (creep.pos.inRangeTo(target, this.targetRange)) {
            var workResult = this.work();
            if (workResult != OK) {
                creep.log("Error executing " + this.name + ", returned " + workResult);
            }
            return workResult;
        } else {
            creep.moveToVisual(target, this.moveColor);
        }
    };
    // Task to perform when at the target
    this.work = function () {
        console.log("Error: Task.work() must be overwritten.");
        return ERR_INVALID_ARGS; // needs override
    };
};
// Shortcuts to creep and target options
Object.defineProperties(Task.prototype, {
    creep: {
        get: function () { // Get task's own creep by its name
            if (this.creepName != null) {
                return Game.creeps[this.creepName];
            } else {
                console.log(this.name + ": creep is null!");
                return null;
            }
        },
        set: function (creep) {
            this.creepName = creep.name;
        }
    },
    target: {
        get: function () {
            if (this.targetID != null) { // Get task's own target by its ID or name
                return Game.getObjectById(this.targetID) || Game.spawns[this.targetID] || Game.flags[this.targetID];
            } else {
                console.log(this.name + ": target is null!");
                return null;
            }
        },
        set: function (target) {
            this.targetID = target.id || target.name || null;
        }
    }
});

module.exports = Task;