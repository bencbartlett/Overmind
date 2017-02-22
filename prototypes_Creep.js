//require('prototypes_creep_targeting');


var tasks = require('tasks');
var rolesMap = require('rolesMap');

Creep.prototype.run = function () {
    this.doRole();
};

Creep.prototype.doRole = function () {
    rolesMap[this.memory.role].behavior.run(this);
};

Creep.prototype.assign = function (task, target = null) { // wrapper for task.assign(creep, target)
    task.assign(this, target);
};

Object.defineProperty(Creep.prototype, 'task', {
    get: function () { // provide new task object recreated from literals stored in creep.memory.task
        if (this.memory.task != null) {
            var task = tasks(this.memory.task.name);
            task.creepName = this.memory.task.creepName;
            task.targetID = this.memory.task.targetID;
            task.data = this.memory.task.data;
            return task;
        } else {
            return null;
        }
    },
    set: function(newTask) {
        if (newTask != null) {
            this.log("use Creep.assign() to assign tasks. Creep.task = ___ should only be used to null a task.");
        } else {
            this.memory.task = newTask;
        }
    }
});

Creep.prototype.moveToVisual = function (target, color = '#fff') {
    var visualizePath = true;
    if (visualizePath) {
        var pathStyle = {
            fill: 'transparent',
            stroke: color,
            lineStyle: 'dashed',
            strokeWidth: .15,
            opacity: .3
        };
        return this.moveTo(target, {visualizePathStyle: pathStyle});
    } else {
        return this.moveTo(target);
    }
};

Creep.prototype.isInRoom = function (roomName) {
    return (this.room.name == roomName);
};

Creep.prototype.myRoom = function () {
    return Game.rooms[this.memory.origin];
};

Creep.prototype.repairNearbyDamagedRoad = function () {
    // repairs roads without sating any extra energy (requiring that there are numWorks*100 hp missing)
    if (this.getActiveBodyparts(WORK) > 0) {
        var damagedRoads = this.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: (structure) => structure.structureType == STRUCTURE_ROAD &&
                                   structure.hitsMax - structure.hits > this.getActiveBodyparts(WORK) * 100
        });
        if (damagedRoads.length > 0) {
            return this.repair(damagedRoads[0]);
        }
    }
    return OK;
};

Creep.prototype.donate = function (roomName) {
    // Donates a creep to a different room. Creep will move to room until it is in the room, then it will
    // continue to work as normal. Does not work with all creep types. Must have vision of room.
    if (Game.rooms[roomName]) {
        this.memory.data.serviceRoom = roomName;
        return OK;
    } else {
        this.log('I could not be donated: ' + roomName + ' is ' + Game.rooms[roomName]);
    }
};

Creep.prototype.donationHandler = function () {
    if (this.memory.donated) {
        var controller = Game.rooms[this.memory.donated].controller;
        if (!this.pos.inRangeTo(controller.pos, 5)) { // walk to controller (avoids room edge effects)
            this.memory.target = undefined; // clear target so creep won't come running back to old room
            this.moveToVisual(controller);
            return ERR_NOT_IN_RANGE;
        } else {
            this.memory.donated = undefined; // clear donation status
        }
    } else {
        return OK;
    }
};