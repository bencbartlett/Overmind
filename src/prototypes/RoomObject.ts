// RoomObject prototypes

Object.defineProperty(RoomObject.prototype, 'ref', { // reference object; see globals.deref (which includes Creep)
	get: function(this: _HasId & { name:string }) {
		return this.id || this.name || '';
	},
	configurable: true,
});

Object.defineProperty(RoomObject.prototype, 'targetedBy', { // List of creep names with tasks targeting this object
	get: function(this: RoomObject) {
		return Overmind.cache.targets[this.ref] || [];
	},
	configurable: true,
});

RoomObject.prototype.serialize = function(this: RoomObject): ProtoRoomObject {
	const pos: ProtoPos = {
		x       : this.pos.x,
		y       : this.pos.y,
		roomName: this.pos.roomName
	};
	return {
		pos: pos,
		ref: this.ref
	};
};
