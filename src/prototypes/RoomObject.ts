import {
	isConstructionSite,
	isCreep,
	isDeposit,
	isMineral,
	isResource,
	isRuin,
	isSource,
	isStructure,
	isTombstone,
} from "declarations/typeGuards";

// RoomObject prototypes

export function roomObjectType(obj: RoomObject) {
	let type;
	if (isRuin(obj)) type = "ruin";
	else if (isTombstone(obj)) type = "tombstone";
	else if (isResource(obj)) type = "resource";
	else if (isStructure(obj)) type = obj.structureType;
	else if (isSource(obj)) type = "source";
	else if (isMineral(obj)) type = `mineral of ${obj.mineralType}`;
	else if (isDeposit(obj)) type = `deposit of ${obj.depositType}`;
	else if (isConstructionSite(obj)) type = `${obj.structureType} (site)`;
	else if (obj instanceof PowerCreep) {
		type = `powercreep ${obj.name} (owned by ${obj.owner.username})`;
	} else if (isCreep(obj)) {
		type = `creep ${obj.name} (owned by ${obj.owner.username})`;
	} else {
		type = "unknown";
	}
	return type;
}

Object.defineProperty(RoomObject.prototype, "print", {
	get(this: RoomObject) {
		return `${roomObjectType(this)} ${this.pos.print}`;
	},
	configurable: true,
});

Object.defineProperty(RoomObject.prototype, 'ref', { // reference object; see globals.deref (which includes Creep)
	get         : function() {
		return this.id || this.name || '';
	},
	configurable: true,
});

Object.defineProperty(RoomObject.prototype, 'targetedBy', { // List of creep names with tasks targeting this object
	get         : function() {
		return Overmind.cache.targets[this.ref] || [];
	},
	configurable: true,
});

RoomObject.prototype.serialize = function(): ProtoRoomObject {
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
