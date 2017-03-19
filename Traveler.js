/**
 * To start using Traveler, require it in main.js:
 * Example: var Traveler = require('Traveler.js');
 *
 * Check the footer of this file for suggestions on how to access it at various scopes
 *
 */

"use strict";
const REPORT_CPU_THRESHOLD = 100; // TODO: get this to: 50;
const DEFAULT_MAXOPS = 20000;
const DEFAULT_STUCK_VALUE = 5;
class Traveler {
    constructor() {
        // change this memory path to suit your needs
        if (!Memory.empire) {
            Memory.empire = {}; // this object will have keys as roomNames and values of the controller level
        }
        if (!Memory.empire.hostileRooms) {
            Memory.empire.hostileRooms = {};
        }
        this.memory = Memory.empire;
    }

    findAllowedRooms(origin, destination, options = {}) {
        _.defaults(options, {restrictDistance: 16});
        if (Game.map.getRoomLinearDistance(origin, destination) > options.restrictDistance) {
            return;
        }
        let allowedRooms = {[origin]: true, [destination]: true};
        let ret = Game.map.findRoute(origin, destination, {
            routeCallback: (roomName) => {
                if (options.routeCallback) {
                    let outcome = options.routeCallback(roomName);
                    if (outcome !== undefined) {
                        return outcome;
                    }
                }
                if (Game.map.getRoomLinearDistance(origin, roomName) > options.restrictDistance) {
                    return false;
                }
                let parsed;
                if (options.preferHighway) {
                    parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    let isHighway = (parsed[1] % 10 === 0) || (parsed[2] % 10 === 0);
                    if (isHighway) {
                        return 1;
                    }
                }
                if (!options.allowSK && !Game.rooms[roomName]) {
                    if (!parsed) {
                        parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
                    }
                    let fMod = parsed[1] % 10;
                    let sMod = parsed[2] % 10;
                    let isSK = !(fMod === 5 && sMod === 5) &&
                               ((fMod >= 4) && (fMod <= 6)) &&
                               ((sMod >= 4) && (sMod <= 6));
                    if (isSK) {
                        return 10;
                    }
                }
                if (!options.allowHostile && this.memory.hostileRooms[roomName] &&
                    roomName !== destination && roomName !== origin) {
                    return Number.POSITIVE_INFINITY;
                }
                return 2.5;
            },
        });
        if (!_.isArray(ret)) {
            console.log(`couldn't findRoute to ${destination}`);
            return;
        }
        for (let value of ret) {
            allowedRooms[value.room] = true;
        }
        return allowedRooms;
    }

    findTravelPath(origin, destination, options = {}) {
        _.defaults(options, {
            ignoreCreeps: true,
            range: 1,
            maxOps: DEFAULT_MAXOPS,
            obstacles: [],
        });
        let allowedRooms;
        // allow travelTo() to accept positions or objects as arguments
        let originPos = origin.pos || origin;
        let destinationPos = destination.pos || destination;
        if (options.useFindRoute || (options.useFindRoute === undefined &&
                                     Game.map.getRoomLinearDistance(originPos.roomName, destinationPos.roomName) > 2)) {
            allowedRooms = this.findAllowedRooms(originPos.roomName, destinationPos.roomName, options);
        }
        let callback = (roomName) => {
            if (options.roomCallback) {
                let outcome = options.roomCallback(roomName, options.ignoreCreeps);
                if (outcome !== undefined) {
                    return outcome;
                }
            }
            if (allowedRooms) {
                if (!allowedRooms[roomName]) {
                    return false;
                }
            }
            else if (this.memory.hostileRooms[roomName] && !options.allowHostile) {
                return false;
            }
            let room = Game.rooms[roomName];
            if (!room) {
                return;
            }
            let matrix;
            if (options.ignoreStructures) {
                matrix = new PathFinder.CostMatrix();
                if (!options.ignoreCreeps) {
                    Traveler.addCreepsToMatrix(room, matrix);
                }
            }
            else if (options.ignoreCreeps || roomName !== originPos.roomName) {
                matrix = this.getStructureMatrix(room);
            }
            else {
                matrix = this.getCreepMatrix(room);
            }
            for (let obstacle of options.obstacles) {
                matrix.set(obstacle.pos.x, obstacle.pos.y, 0xff);
            }
            return matrix;
        };
        return PathFinder.search(originPos, {pos: destinationPos, range: options.range}, {
            maxOps: options.maxOps,
            plainCost: options.ignoreRoads ? 1 : 2,
            roomCallback: callback,
            swampCost: options.ignoreRoads ? 5 : 10,
        });
    }

    travelTo(creep, destination, options = {}) {
        // allow travelTo() to accept positions or objects as arguments
        let destinationPos = destination.pos || destination;
        // register hostile rooms entered
        if (creep.room.controller) {
            if (creep.room.controller.owner && !creep.room.controller.my) {
                this.memory.hostileRooms[creep.room.name] = creep.room.controller.level;
            }
            else {
                this.memory.hostileRooms[creep.room.name] = undefined;
            }
        }
        // initialize data object
        if (!creep.memory._travel) {
            creep.memory._travel = {stuck: 0, tick: Game.time, cpu: 0, count: 0};
        }
        let travelData = creep.memory._travel;
        if (creep.fatigue > 0) {
            travelData.tick = Game.time;
            return ERR_BUSY;
        }
        if (!destination) {
            return ERR_INVALID_ARGS;
        }
        // manage case where creep is nearby destination
        let rangeToDestination = creep.pos.getRangeTo(destinationPos);
        if (rangeToDestination <= options.range) {
            return OK;
        }
        else if (rangeToDestination <= 1) {
            if (rangeToDestination === 1 && !options.range) {
                if (options.returnData) {
                    options.returnData.nextPos = destinationPos;
                }
                return creep.move(creep.pos.getDirectionTo(destinationPos));
            }
            return OK;
        }
        // check if creep is stuck
        let hasMoved = true;
        if (travelData.prev) {
            travelData.prev = Traveler.initPosition(travelData.prev);
            if (creep.pos.inRangeTo(travelData.prev, 0)) {
                hasMoved = false;
                travelData.stuck++;
            }
            else {
                travelData.stuck = 0;
            }
        }
        // handle case where creep is stuck
        if (travelData.stuck >= DEFAULT_STUCK_VALUE && !options.ignoreStuck) {
            options.ignoreCreeps = false;
            delete travelData.path;
        }
        // handle case where creep wasn't traveling last tick and may have moved, but destination is still the same
        if (Game.time - travelData.tick > 1 && hasMoved) {
            delete travelData.path;
        }
        travelData.tick = Game.time;
        // delete path cache if destination is different
        if (!travelData.dest || travelData.dest.x !== destinationPos.x || travelData.dest.y !== destinationPos.y ||
            travelData.dest.roomName !== destinationPos.roomName) {
            delete travelData.path;
        }
        // pathfinding
        if (!travelData.path) {
            if (creep.spawning) {
                return ERR_BUSY;
            }
            travelData.dest = destinationPos;
            travelData.prev = undefined;
            let cpu = Game.cpu.getUsed();
            let ret = this.findTravelPath(creep, destination, options);
            travelData.cpu += (Game.cpu.getUsed() - cpu);
            travelData.count++;
            if (travelData.cpu > REPORT_CPU_THRESHOLD) {
                console.log(`TRAVELER: heavy cpu use: ${creep.name}, cpu: ${_.round(travelData.cpu, 2)},\n` +
                            `origin: ${creep.pos}, dest: ${destinationPos}`);
            }
            if (ret.incomplete) {
                console.log(`TRAVELER: incomplete path for ${creep.name}`);
                if (ret.ops < 2000 && options.useFindRoute === undefined && travelData.stuck < DEFAULT_STUCK_VALUE) {
                    options.useFindRoute = false;
                    ret = this.findTravelPath(creep, destination, options);
                    console.log(`attempting path without findRoute was ${ret.incomplete ? "not" : ""} successful`);
                }
            }
            travelData.path = Traveler.serializePath(creep.pos, ret.path);
            travelData.stuck = 0;
        }
        if (!travelData.path || travelData.path.length === 0) {
            return ERR_NO_PATH;
        }
        // consume path and move
        if (travelData.prev && travelData.stuck === 0) {
            travelData.path = travelData.path.substr(1);
        }
        travelData.prev = creep.pos;
        let nextDirection = parseInt(travelData.path[0], 10);
        if (options.returnData) {
            options.returnData.nextPos = Traveler.positionAtDirection(creep.pos, nextDirection);
        }
        // let pathColor = '#fff';
        // if (creep.task) { // receive visualization color from creep's task
        //     pathColor = creep.task.moveColor;
        // }
        // Traveler.visualizePath(creep, travelData.path, pathColor);
        return creep.move(nextDirection);
    }

    getStructureMatrix(room) {
        this.refreshMatrices();
        if (!this.structureMatrixCache[room.name]) {
            let matrix = new PathFinder.CostMatrix();
            this.structureMatrixCache[room.name] = Traveler.addStructuresToMatrix(room, matrix, 1);
        }
        return this.structureMatrixCache[room.name];
    }

    static initPosition(pos) {
        return new RoomPosition(pos.x, pos.y, pos.roomName);
    }

    static addStructuresToMatrix(room, matrix, roadCost) {
        for (let structure of room.find(FIND_STRUCTURES)) {
            if (structure instanceof StructureRampart) {
                if (!structure.my && !structure.isPublic) {
                    matrix.set(structure.pos.x, structure.pos.y, 0xff);
                }
            }
            else if (structure instanceof StructureRoad) {
                matrix.set(structure.pos.x, structure.pos.y, roadCost);
            }
            else if (structure.structureType !== STRUCTURE_CONTAINER) {
                // Can't walk through non-walkable buildings
                matrix.set(structure.pos.x, structure.pos.y, 0xff);
            }
        }
        for (let site of room.find(FIND_CONSTRUCTION_SITES)) {
            if (site.structureType === STRUCTURE_CONTAINER || site.structureType === STRUCTURE_ROAD) {
                continue;
            }
            matrix.set(site.pos.x, site.pos.y, 0xff);
        }
        return matrix;
    }

    getCreepMatrix(room) {
        this.refreshMatrices();
        if (!this.creepMatrixCache[room.name]) {
            this.creepMatrixCache[room.name] = Traveler.addCreepsToMatrix(room, this.getStructureMatrix(room).clone());
        }
        return this.creepMatrixCache[room.name];
    }

    static addCreepsToMatrix(room, matrix) {
        room.find(FIND_CREEPS).forEach((creep) => matrix.set(creep.pos.x, creep.pos.y, 0xff));
        return matrix;
    }

    static visualizePath(creep, path, pathColor = '#fff') {
        let lastPosition = creep.pos;
        for (let position of path) {
            if (position.roomName === lastPosition.roomName) {
                new RoomVisual(position.roomName).line(position, lastPosition, {
                    color: pathColor,
                    opacity: 0.15,
                    style: 'dashed'
                });
            }
            lastPosition = position;
        }
    }

    static serializePath(startPos, path) {
        let serializedPath = "";
        let lastPosition = startPos;
        for (let position of path) {
            if (position.roomName === lastPosition.roomName) {
                // new RoomVisual(position.roomName).line(position, lastPosition, {
                //     color: pathColor,
                //     opacity: 0.15,
                //     style: 'dashed'
                // });
                serializedPath += lastPosition.getDirectionTo(position);
            }
            lastPosition = position;
        }
        return serializedPath;
    }

    refreshMatrices() {
        if (Game.time !== this.currentTick) {
            this.currentTick = Game.time;
            this.structureMatrixCache = {};
            this.creepMatrixCache = {};
        }
    }

    static positionAtDirection(origin, direction) {
        let offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
        let offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
        return new RoomPosition(origin.x + offsetX[direction], origin.y + offsetY[direction], origin.roomName);
    }
}

profiler.registerClass(Traveler, 'Traveler');


// uncomment this to have an instance of traveler available through import
// exports.traveler = new Traveler();

// uncomment to assign an instance to global
// global.traveler = new Traveler();

// uncomment this block to assign a function to Creep.prototype: creep.travelTo(destination)
const traveler = new Traveler();
Creep.prototype.travelTo = function (destination, options) {
    return traveler.travelTo(this, destination, options);
};


exports.Traveler = Traveler;
