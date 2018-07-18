// RoomObject prototypes

Object.defineProperty(RoomObject.prototype, 'ref', { // reference object; see globals.deref (which includes Creep)
	get         : function () {
		return this.id || this.name || '';
	},
	configurable: true,
});

Object.defineProperty(RoomObject.prototype, 'targetedBy', { // List of creep names with tasks targeting this object
	get         : function () {
		return Overmind.cache.targets[this.ref] || [];
	},
	configurable: true,
});

// Link association ====================================================================================================

Object.defineProperty(RoomObject.prototype, 'linked', { // If an object has a nearby link
	get         : function () {
		return this.pos.findInRange(this.room.links, 2).length > 0;
	},
	configurable: true,
});

Object.defineProperty(RoomObject.prototype, 'nearbyLinks', { // All links that are near an object
	get         : function () {
		return this.pos.findInRange(this.room.links, 2);
	},
	configurable: true,
});

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
