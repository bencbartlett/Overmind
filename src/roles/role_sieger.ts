// Sieger - large armored worker specializing in taking down walls while under fire
// Best used to siege a contiguous room; healing stations of some sort should be stationed in the neighboring room
// Sieger will dismanlte walls while under fire until it is low enough that it needs to leave the room to be healed

import {Role} from "./Role";
import {taskGetBoosted} from "../tasks/task_getBoosted";
import {taskGoToRoom} from "../tasks/task_goToRoom";
import {taskDismantle} from "../tasks/task_dismantle";
import {flagFilters} from "../maps/map_flag_filters";

export class roleSieger extends Role {
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
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(WORK) > 1 &&
                                                  creep.getActiveBodyparts(HEAL) > 1 &&
                                                  creep.getActiveBodyparts(MOVE) > 1
    }

    onCreate(creep: protoCreep): protoCreep {
        creep.memory.data.healFlag = "HP1"; // TODO: hard coded
        return creep;
    }

    findTarget(creep: Creep): Structure | void {
        var target;
        var targetPriority = [
            () => creep.pos.findClosestByRange(_.map(_.filter(creep.room.flags, flagFilters.destroy.dismantle.filter),
                                                     (flag: Flag) => flag.pos.lookFor(LOOK_STRUCTURES)[0])),
            // () => creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
            () => creep.pos.findClosestByRange(
                FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits && s.structureType == STRUCTURE_TOWER}),
            () => creep.pos.findClosestByRange(
                FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits && s.structureType != STRUCTURE_RAMPART}),
            () => creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits}),
            () => creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s: Structure) => !s.room.my && !s.room.reservedByMe && s.hits,
            }),
        ];
        for (let targetThis of targetPriority) {
            target = targetThis() as Structure;
            if (target) {
                return target;
            }
        }
    }

    retreatAndHeal(creep: Creep) { // TODO: make this a task
        creep.heal(creep);
        return creep.travelTo(creep.memory.data.healFlag, {allowHostile: true});
    }

    getBoosted(creep: Creep) {
        for (let bodypart in this.settings.boost) {
            if (this.settings.boost[bodypart] &&
                !(creep.memory.boosted && creep.memory.boosted[this.settings.boostMinerals[bodypart]])) {
                let boosters = _.filter(creep.room.labs, (lab: StructureLab) =>
                                        lab.assignedMineralType == this.settings.boostMinerals[bodypart] &&
                                        lab.mineralAmount >= 30 * creep.getActiveBodyparts(bodypart),
                );
                if (boosters.length > 0) {
                    creep.task = null;
                    creep.assign(new taskGetBoosted(boosters[0]));
                }
            }
        }
    }

    run(creep: Creep) {
        this.getBoosted(creep);
        var assignment = creep.assignment as Flag;
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
                let task = new taskGoToRoom(assignment);
                task.data.travelToOptions['allowHostile'] = true;
                creep.assign(task);
            }
            // 2.2: ATTACK SOMETHING
            var target = this.findTarget(creep);
            if (target) {
                let task = new taskDismantle(target);
                task.data.travelToOptions['allowHostile'] = true;
                creep.assign(task);
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
