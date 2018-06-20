// Type guard functions

export interface EnergyStructure extends Structure {
	energy: number;
	energyCapacity: number;
}

export interface StoreStructure extends Structure {
	store: StoreDefinition;
	storeCapacity: number;
}

export function isEnergyStructure(structure: Structure): structure is EnergyStructure {
	return (<EnergyStructure>structure).energy != undefined && (<EnergyStructure>structure).energyCapacity != undefined;
}

export function isStoreStructure(structure: Structure): structure is StoreStructure {
	return (<StoreStructure>structure).store != undefined;
}

export function hasPos(obj: HasPos | RoomPosition): obj is HasPos {
	return (<HasPos>obj).pos != undefined;
}

export function isResource(obj: RoomObject): obj is Resource {
	return (<Resource>obj).amount != undefined;
}