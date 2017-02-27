var tasks = require('tasks');
var rolesMap = require('map_roles');

Creep.prototype.run = function () {
    var behavior = rolesMap[this.memory.role].behavior;
    if (behavior) {
        behavior.run(this);
    }
};

Creep.prototype.doRole = function () {
    rolesMap[this.memory.role].behavior.run(this);
};

Creep.prototype.assign = function (task, target = null) { // wrapper for task.assign(creep, target)
    return task.assign(this, target);
};

Object.defineProperty(Creep.prototype, 'task', {
    get: function () { // provide new task object recreated from literals stored in creep.memory.task
        if (this.memory.task != null) {
            // NOTE: task migration should be performed here
            // if (this.memory.task.name == 'transferEnergy') {
            //     this.memory.task.name = 'deposit'
            // }
            var task = tasks(this.memory.task.name);
            task.creepName = this.memory.task.creepName;
            task.targetID = this.memory.task.targetID;
            task.data = this.memory.task.data;
            return task;
        } else {
            return null;
        }
    },
    set: function (newTask) {
        if (newTask != null) {
            this.log("use Creep.assign() to assign tasks. Creep.task = ___ should only be used to null a task.");
        } else {
            this.memory.task = newTask;
        }
    }
});

Object.defineProperty(Creep.prototype, 'workRoom', { // retrieve the room object (not the name) of the assigned room
    get: function () {
        return Game.rooms[this.memory.workRoom];
    },
    set: function (newWorkRoom) {
        this.memory.workRoom = newWorkRoom.name;
    }
});

Object.defineProperty(Creep.prototype, 'lifetime', { // creep lifetime; 1500 unless claimer, then 500
    get: function () {
        if (_.map(this.body, part => part.type).includes(CLAIM)) {
            return 500;
        } else {
            return 1500;
        }
    }
});

Object.defineProperty(Creep.prototype, 'assignment', { // retrieve the assignment object
    get: function () {
        return deref(this.memory.assignment);
    },
    set: function (newAssignmentObject) {
        this.log("warning: unsafe change of creep assignment from " +
                 this.memory.assignment + " to " + newAssignmentObject + "!");
        this.memory.assignment = newAssignment.ref
    }
});

Creep.prototype.calculatePathETA = function (startPoint, endPoint, ignoreCargo = false) {
    var path = startPoint.findPathTo(endPoint);
    var massiveParts = [WORK, ATTACK, RANGED_ATTACK, HEAL, TOUGH];
    var mass = 0;
    for (let part of massiveParts) {
        mass += this.getActiveBodyparts(part);
    }
    var cargoMass = Math.ceil(_.sum(this.carry) / 50);
    var moveParts = this.getActiveBodyparts(MOVE);
    var fatiguePerTick = 2 * mass;
    if (!ignoreCargo) {
        fatiguePerTick += 2 * cargoMass;
    }
    var ETA = 0;
    // console.log(mass, cargoMass, moveParts, fatiguePerTick, ETA);
    for (let step of path) {
        let road = _.filter(this.room.lookForAt(LOOK_STRUCTURES, step.x, step.y),
                            s => s.structureType == STRUCTURE_ROAD)[0];
        let terrain = this.room.lookForAt(LOOK_TERRAIN, step.x, step.y)[0];
        let multiplier;
        if (road) {
            multiplier = 0.5;
        } else if (terrain == 'plain') {
            multiplier = 1;
        } else if (terrain == 'swamp') {
            multiplier = 5;
        }
        let dt = Math.ceil(multiplier * fatiguePerTick / (2 * moveParts));
        // this.log(dt);
        ETA += dt;
    }
    return ETA;
};

Creep.prototype.conditionalMoveToWorkRoom = function () { // move to workRoom if not already there
    if (this.room != this.workRoom) {
        this.moveToVisual(this.workRoom.controller);
        return ERR_NOT_IN_SERVICE_ROOM;
    } else {
        return OK;
    }
};

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
        this.memory.workRoom = roomName;
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