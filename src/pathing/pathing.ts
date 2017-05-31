export var pathing = {
	findPathLengthIncludingRoads: function (startPos: RoomPosition, endPos: RoomPosition) {
		let ret = PathFinder.search(
			startPos, [{pos: endPos, range: 2}],
			[{
				plainCost   : 2,
				swampCost   : 10,
				roomCallback: function (roomName: string) {
					let room = Game.rooms[roomName];
					if (!room) return;
					let costs = new PathFinder.CostMatrix();

					room.find(FIND_STRUCTURES).forEach(function (structure: any) {
						if (structure.structureType === STRUCTURE_ROAD) {
							// Favor roads over plain tiles
							costs.set(structure.pos.x, structure.pos.y, 1);
						} else if (structure.structureType !== STRUCTURE_CONTAINER &&
								   (structure.structureType !== STRUCTURE_RAMPART || !structure.my)) {
							// Can't walk through non-walkable buildings
							costs.set(structure.pos.x, structure.pos.y, 0xff);
						}
					});
					return costs;
				},
			}],
		);
		let path = ret.path;
		return path.length + 1; // offset for range
	},

	cachedPathLength: function (arg1: RoomPosition, arg2: RoomPosition) {
		let pos1, pos2: RoomPosition;
		if (arg1.name < arg2.name) { // alphabetize since path lengths are the same either direction
			pos1 = arg1;
			pos2 = arg2;
		} else {
			pos1 = arg2;
			pos2 = arg1;
		}
		if (!Memory.pathLengths) {
			Memory.pathLengths = {};
		}
		if (!Memory.pathLengths[pos1.name]) {
			Memory.pathLengths[pos1.name] = {};
		}
		if (!Memory.pathLengths[pos1.name][pos2.name]) {
			Memory.pathLengths[pos1.name][pos2.name] = this.findPathLengthIncludingRoads(pos1, pos2);
		}
		return Memory.pathLengths[pos1.name][pos2.name];
	},
};

import profiler = require('../lib/screeps-profiler');
profiler.registerObject(pathing, 'pathing');

