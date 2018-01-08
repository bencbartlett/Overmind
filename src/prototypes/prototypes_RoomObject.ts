// RoomObject prototypes


// determines if object is in same room as other object in possibly undefined room
// RoomObject.prototype.inSameRoomAs = function (otherObject) {
// 	return this.pos.roomName == otherObject.pos.roomName;
// };

Object.defineProperty(RoomObject.prototype, 'ref', { // reference object; see globals.deref (which includes Creep)
	get: function () {
		return this.id || this.name || null;
	},
});

// Colony association ==================================================================================================

// Object.defineProperty(RoomObject.prototype, 'colony', { // link to colony object in the overmind
// 	get () {
// 		let colonyName = Overmind.colonyMap[this.pos.roomName];
// 		return Overmind.Colonies[colonyName];
// 	},
// });
//
// Object.defineProperty(RoomObject.prototype, 'colonyName', { // name of the colony object in the overmind
// 	get () {
// 		return Overmind.colonyMap[this.pos.roomName];
// 	},
// });

// Assigned and targeted creep indexing ================================================================================

// Object.defineProperty(RoomObject.prototype, 'assignedCreepNames', { // keys: roles, values: names
// 	get: function () {
// 		if (Overmind.cache.assignments[this.ref]) {
// 			return Overmind.cache.assignments[this.ref];
// 		} else {
// 			return {};
// 		}
// 	},
// });
//
// // TODO: put needsReplacing in its own function on creeps
// RoomObject.prototype.getAssignedCreeps = function (role) {
// 	let creepNames = this.assignedCreepNames[role];
// 	return _.filter(_.map(creepNames, (name: string) => Game.zerg[name]), creep => creep.needsReplacing == false);
// };

// RoomObject.prototype.getAssignedCreepAmounts = function (role) {
// 	let amount = this.getAssignedCreeps(role).length;
// 	return amount || 0;
// };
//
// Object.defineProperty(RoomObject.prototype, 'assignedCreepAmounts', {
// 	get: function () {
// 		if (Overmind.cache.assignments[this.ref]) {
// 			let creepNamesByRole = Overmind.cache.assignments[this.ref];
// 			for (let role in creepNamesByRole) { // only include creeps that shouldn't be replaced yet
// 				creepNamesByRole[role] = _.filter(creepNamesByRole[role],
// 												  (name: string) => Game.zerg[name].needsReplacing == false);
// 			}
// 			return _.mapValues(creepNamesByRole, creepList => creepList.length);
// 		} else {
// 			console.log('Regenerating assigned creep amounts! (Why?)');
// 			let assignedCreeps = _.filter(Game.zerg,
// 										  creep => creep.memory.assignmentRef == this.ref &&
// 												   creep.needsReplacing == false);
// 			return _.mapValues(_.groupBy(assignedCreeps, creep => creep.memory.role), creepList => creepList.length);
// 		}
// 	},
// });

Object.defineProperty(RoomObject.prototype, 'targetedBy', { // List of creep names with tasks targeting this object
	get: function () {
		return Overmind.cache.targets[this.ref];
	},
});

RoomObject.prototype.isTargetFor = function (taskName?: string): ITask[] {
	if (taskName) {
		let targetingTasks = _.compact(_.map(this.targetedBy, (name: string) => Game.zerg[name].task)) as ITask[];
		return _.filter(targetingTasks, task => task.name == taskName);
	} else {
		return _.compact(_.map(this.targetedBy, (name: string) => Game.zerg[name].task)) as ITask[];
	}
};


// Flag association ====================================================================================================

// Object.defineProperty(RoomObject.prototype, 'flagged', { // if the object has a flag
// 	get: function () {
// 		return this.pos.flagged;
// 	},
// });
//
// RoomObject.prototype.flaggedWith = function (filter) { // if the object has a certain type of flag
// 	return this.pos.flaggedWith(filter);
// };


// Link association ====================================================================================================

Object.defineProperty(RoomObject.prototype, 'linked', { // If an object has a nearby link
	get: function () {
		return this.pos.findInRange(this.room.links, 2).length > 0;
	},
});

Object.defineProperty(RoomObject.prototype, 'nearbyLinks', { // All links that are near an object
	get: function () {
		return this.pos.findInRange(this.room.links, 2);
	},
});


// Path length caching =================================================================================================

// Object.defineProperty(RoomObject.prototype, 'pathLengthToStorage', { // find and cache a path length to storage
// 	get () {
// 		if (!this.room.memory.storagePathLengths) {
// 			this.room.memory.storagePathLengths = {};
// 		}
// 		if (!this.room.memory.storagePathLengths[this.ref]) {
// 			this.room.memory.storagePathLengths[this.ref] = PathFinder.search(this.room.storage.pos,
// 																			  this.pos).path.length;
// 		}
// 		return this.room.memory.storagePathLengths[this.ref];
// 	},
// });
//
// RoomObject.prototype.pathLengthTo = function (roomObj) {
// 	if (!this.memory.pathLengths) {
// 		this.memory.pathLengths = {};
// 	}
// 	if (!this.memory.pathLengths[roomObj.ref]) {
// 		this.memory.pathLengths[roomObj.ref] = pathing.findPathLengthIncludingRoads(roomObj.pos, this.pos);
// 	}
// 	return this.memory.pathLengths[roomObj.ref];
// };

RoomObject.prototype.serialize = function (): protoRoomObject {
	let pos: protoPos = {
		x       : this.pos.x,
		y       : this.pos.y,
		roomName: this.pos.roomName
	};
	return {
		pos: pos,
		ref: this.ref
	};
};