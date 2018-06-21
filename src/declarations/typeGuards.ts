// Type guard functions

export interface EnergyStructure extends Structure {
	energy: number;
	energyCapacity: number;
}

export interface StoreStructure extends Structure {
	store: StoreDefinition;
	storeCapacity: number;
}

export function isEnergyStructure(obj: RoomObject): obj is EnergyStructure {
	return (<EnergyStructure>obj).energy != undefined && (<EnergyStructure>obj).energyCapacity != undefined;
}

export function isStoreStructure(obj: RoomObject): obj is StoreStructure {
	return (<StoreStructure>obj).store != undefined && (<StoreStructure>obj).storeCapacity != undefined;
}

export function isTombstone(obj: RoomObject): obj is Tombstone {
	return (<Tombstone>obj).deathTime != undefined;
}

export function isResource(obj: RoomObject): obj is Resource {
	return (<Resource>obj).amount != undefined;
}

export function hasPos(obj: HasPos | RoomPosition): obj is HasPos {
	return (<HasPos>obj).pos != undefined;
}

