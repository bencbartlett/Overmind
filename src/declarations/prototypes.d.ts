interface Creep {
	memory: CreepMemory;

	travelTo(destination: RoomPosition | { pos: RoomPosition }, options?: any): number;
}

interface Flag {
	colony: IColony;

	recalculateColony(restrictDistance?: number): void;
}

type Sink = StructureSpawn |
	StructureExtension |
	StructureLab |
	StructurePowerSpawn |
	StructureNuker |
	StructureTower;
type StorageUnit = StructureContainer | StructureTerminal | StructureStorage;

// type StoreStructure = StructureTerminal|StructureContainer|StructureStorage;
// interface EnergyStructure extends Structure {
// 	pos: RoomPosition;
// 	energy: number;
// 	energyCapacity: number;
// }

interface Room {
	colony: IColony;
	my: boolean;
	reservedByMe: boolean;
	signedByMe: boolean;
	creeps: Creep[];
	hostiles: Creep[];
	hostileStructures: Structure[];
	flags: Flag[];
	// Preprocessed structures
	drops: { [resourceType: string]: Resource[] };
	droppedEnergy: Resource[];
	droppedMinerals: Resource[];
	droppedPower: Resource[];
	structures: { [structureType: string]: Structure[] };
	spawns: Spawn[];
	extensions: StructureExtension[];
	containers: StructureContainer[];
	storageUnits: StorageUnit[];
	towers: StructureTower[];
	links: StructureLink[];
	labs: StructureLab[];
	sources: Source[];
	// sinks: Sink[];
	repairables: Structure[];
	constructionSites: ConstructionSite[];
	structureSites: ConstructionSite[];
	roadSites: ConstructionSite[];
	barriers: (StructureWall | StructureRampart)[];

	getStructures(structureType: string): Structure[];

}

interface RoomObject {
	ref: string;
	targetedBy: string[];
	linked: boolean;
	nearbyLinks: StructureLink[];

	isTargetFor(taskName?: string): ITask[];

	serialize(): protoRoomObject;
}

interface RoomPosition {
	name: string;
	isEdge: boolean;
	rangeToEdge: number;

	getAdjacentPositions(): RoomPosition[];

	getMultiRoomRangeTo(pos: RoomPosition): number;

	findClosestByLimitedRange<T>(objects: T[] | RoomPosition[], rangeLimit: number,
								 opts?: { filter: any | string; }): T;
}

interface RoomVisual {
	multitext(textArray: string[], x: number, starty: number, fontSize: number, style: any): number;

	structure(x: number, y: number, type: string, opts?: { [option: string]: any }): RoomVisual;

	connectRoads(opts?: { [option: string]: any }): RoomVisual | void;

	speech(text: string, x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	animatedPosition(x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	test(): RoomVisual;
}

interface StructureContainer {
	energy: number;
	miningSite: IMiningSite;
	predictedEnergyOnArrival: number;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureController {
	reservedByMe: boolean;
	signedByMe: boolean;

	needsReserving(reserveBuffer: number): boolean;
}

interface StructureExtension {
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureLab {
}

interface StructureLink {
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureNuker {

}

interface StructurePowerSpawn {

}

interface StructureStorage {
	energy: number;
	isFull: boolean;
	isEmpty: boolean;

	creepCanWithdrawEnergy(creep: Zerg): boolean;

}

interface StructureSpawn {
	isFull: boolean;
	isEmpty: boolean;

	cost(bodyArray: string[]): number;

}

interface StructureTerminal {
	energy: any;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureTower {
	isFull: boolean;
	isEmpty: boolean;

	run(): void;

	attackNearestEnemy(): number;

	healNearestAlly(): number;

	repairNearestStructure(): number;

	preventRampartDecay(): number;
}
