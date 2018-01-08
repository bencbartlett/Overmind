interface Creep {
	memory: CreepMemory;
	// getBodyparts(partType: string): number;
	// colony: IColony;
	// lifetime: number;
	travelTo(destination: RoomPosition | { pos: RoomPosition }, options?: any): number;
}

interface Flag {
	colony: IColony;

	recalculateColony(restrictDistance?: number): void;

	// assign(roomName: string): void;
	// unassign(): void;
	// assignedRoom: Room;
	// setMineral(mineralType: string): void;
	// IO: string;
	// code: string;
	// category: any;
	// type: any;
	// action: Function;
	// getRequiredCreepAmounts(role: string): number;
	// requiredCreepAmounts: { [role: string]: number };
	// needsAdditional(role: string): boolean;
	// requestCreepIfNeeded(role: ISetup, options: protoCreepOptions): void;
	// pathLengthToAssignedRoomStorage: number;
	// haulingNeeded: boolean;
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
	// colonyFlag: Flag;
	colony: IColony;
	// setColony(colonyName: string): void;
	// overseer: IOverseer;
	my: boolean;
	reservedByMe: boolean;
	signedByMe: boolean;
	creeps: Creep[];
	hostiles: Creep[];
	hostileStructures: Structure[];
	flags: Flag[];
	// assignedFlags: Flag[];
	remainingConstructionProgress: number;
	// Preprocessed structures
	drops: { [resourceType: string]: Resource[] };
	droppedEnergy: Resource[];
	droppedMinerals: Resource[];
	droppedPower: Resource[];
	structures: { [structureType: string]: Structure[] };
	getStructures(structureType: string): Structure[];
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
}

interface RoomObject {
	// inSameRoomAs(otherObject: RoomObject | IDirective): boolean;
	ref: string;
	// colony: IColony | undefined;
	// colonyName: string | undefined;
	// assignedCreepNames: { [role: string]: string };
	// getAssignedCreeps(role: string): Zerg[];

	// getAssignedCreepAmounts(role: string): number;
	// assignedCreepAmounts: { [role: string]: number };
	targetedBy: string[];

	isTargetFor(taskName?: string): ITask[];
	// flagged: boolean;
	// flaggedWith(filter: Function): boolean;
	linked: boolean;
	nearbyLinks: StructureLink[];
	// pathLengthToStorage: number;
	// pathLengthTo(otherObject: RoomObject): number;
	serialize(): protoRoomObject;
}

interface RoomPosition {
	name: string;
	// flagged: boolean;
	isEdge: boolean;
	rangeToEdge: number;
	getAdjacentPositions(): RoomPosition[];

	// flaggedWith(filter: Function): boolean;
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
	// refillThis: boolean;
	// miningFlag: Flag;
	miningSite: IMiningSite;
	predictedEnergyOnArrival: number;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureController {
	needsReserving(reserveBuffer: number): boolean;
	reservedByMe: boolean;
	signedByMe: boolean;
}

interface StructureExtension {
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureLab {
	// assignedMineralType: string;
	// IO: string;
	// maxAmount: number;
}

interface StructureLink {
	// refillThis: boolean;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureNuker {

}

interface StructurePowerSpawn {

}

interface StructureStorage {
	energy: number;

	creepCanWithdrawEnergy(creep: Zerg): boolean;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureSpawn {
	cost(bodyArray: string[]): number;
	// uptime: number;
	// statusMessage: string;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureTerminal {
	energy: any;
	// brain: any;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureTower {
	run(): void;
	attackNearestEnemy(): number;
	healNearestAlly(): number;
	repairNearestStructure(): number;
	preventRampartDecay(): number;
	isFull: boolean;
	isEmpty: boolean;
}
