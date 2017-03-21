// Sieger - large armored worker specializing in taking down walls while under fire
// Best used to siege a contiguous room; healing stations of some sort should be stationed in the neighboring room
// Sieger will dismanlte walls while under fire until it is low enough that it needs to leave the room to be healed

var tasks = require('tasks');
var flagCodes = require('map_flag_codes');
var Role = require('Role');

class roleSieger extends Role {
    constructor() {
        super('sieger');
        // Role-specific settings
        this.settings.bodyPattern = [TOUGH, WORK, MOVE, MOVE, MOVE, HEAL];
        this.settings.moveBoostedBodyPattern = [TOUGH, WORK, WORK, MOVE, HEAL];
        this.settings.nonArmoredBodyPattern = [WORK, MOVE];
        this.settings.bodyPattern = this.settings.nonArmoredBodyPattern; // TODO: remove this if needed
        this.settings.boost = {
            'tough': false,
            'work': false,
            'move': false,
            'heal': false,
        };
        this.settings.boostMinerals = {
            'tough': RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
            'work': RESOURCE_CATALYZED_ZYNTHIUM_ACID,
            'move': RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
            'heal': RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
        };
        this.settings.orderedBodyPattern = true;
        this.settings.avoidHostileRooms = false;
        this.roleRequirements = creep => creep.getActiveBodyparts(WORK) > 1 &&
                                         creep.getActiveBodyparts(HEAL) > 1 &&
                                         creep.getActiveBodyparts(MOVE) > 1
    }

    onCreate(creep) {
        creep.memory.data.healFlag = "HP1"; // TODO: hard coded
        return creep;
    }

    findTarget(creep) {
        var target;
        var targetPriority = [
            () => creep.pos.findClosestByRange(_.map(_.filter(creep.room.flags, flagCodes.destroy.dismantle.filter),
                                                     flag => flag.pos.lookFor(LOOK_STRUCTURES)[0])),
            // () => creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
            () => creep.pos.findClosestByRange(
                FIND_HOSTILE_STRUCTURES, {filter: s => s.hits && s.structureType == STRUCTURE_TOWER}),
            () => creep.pos.findClosestByRange(
                FIND_HOSTILE_STRUCTURES, {filter: s => s.hits && s.structureType != STRUCTURE_RAMPART}),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: s => s.hits}),
            () => creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: s => !s.my && !s.room.my && !s.room.reservedByMe && s.hits
            }),
        ];
        for (let targetThis of targetPriority) {
            target = targetThis();
            if (target) {
                return target;
            }
        }
        return null;
    }

    retreatAndHeal(creep) { // TODO: make this a task
        var healPos = deref(creep.memory.data.healFlag).pos;
        creep.heal(creep);
        return creep.travelTo(healPos, {allowHostile: true});
    }

    getBoosted(creep) {
        for (let bodypart in this.settings.boost) {
            if (this.settings.boost[bodypart] &&
                !(creep.memory.boosted && creep.memory.boosted[this.settings.boostMinerals[bodypart]])) {
                let boosters = _.filter(creep.room.labs,
                                        lab => lab.assignedMineralType == this.settings.boostMinerals[bodypart] &&
                                               lab.mineralAmount >= 30 * creep.getActiveBodyparts(bodypart));
                if (boosters.length > 0) {
                    creep.task = null;
                    creep.assign(tasks('getBoosted'), boosters[0]);
                }
            }
        }
    }

    run(creep) {
        this.getBoosted(creep);
        var assignment = creep.assignment;
        // 1: retreat to heal point when injured
        if (deref(creep.memory.data.healFlag) && // if there's a heal flag
            (creep.getActiveBodyparts(TOUGH) < 0.5 * creep.getBodyparts(TOUGH) || // if you're injured
             (creep.memory.needsHealing && creep.hits < creep.hitsMax))) { // if you're healing and not full hp
            // TODO: dps-based calculation
            creep.memory.needsHealing = true;
            return this.retreatAndHeal(creep);
        } else {
            creep.memory.needsHealing = false; // turn off when done healing
        }
        // 2: task assignment
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) { // get new task
            creep.task = null;
            // 2.1: move to same room as assignment
            if (assignment && !creep.inSameRoomAs(assignment)) {
                let task = tasks('goToRoom');
                task.data.travelToOptions['allowHostile'] = true;
                creep.assign(task, assignment);
            }
            // 2.2: ATTACK SOMETHING
            var target = this.findTarget(creep);
            if (target) {
                let task = tasks('dismantle');
                task.data.travelToOptions['allowHostile'] = true;
                creep.assign(task, target);
            }
        }
        // execute task
        if (creep.task) {
            return creep.task.step();
        }
        // remove flag once everything is destroyed
        if (assignment && creep.room.hostileStructures.length == 0) {
            creep.log("No remaining hostile structures in room; deleting flag!");
            assignment.remove();
        }
    }
}


module.exports = roleSieger;