interface Creep {
//     run(): void;
//     sayLoop(sayList: string[]): void;
	getBodyparts(partType: string): number;
//     needsReplacing: boolean;
//     // workRoom: Room;
	colony: IColony;
	lifetime: number;
//     assignment: RoomObject;
//     objective: IObjective | null;
//     task: ITask;
//     assign(task: ITask): string;
//     moveSpeed: number;
//     repairNearbyDamagedRoad(): number;
	travelTo(destination: RoomPosition | { pos: RoomPosition }, options?: any): number;
}

interface Flag {
	assign(roomName: string): void;
	unassign(): void;
	assignedRoom: Room;
	setMineral(mineralType: string): void;
	IO: string;
	category: any;
	type: any;
	action: Function;
	// getAssignedCreepAmounts(role: string): number;
	// assignedCreepAmounts: { [role: string]: number };
	getRequiredCreepAmounts(role: string): number;
	requiredCreepAmounts: { [role: string]: number };
	needsAdditional(role: string): boolean;
	requestCreepIfNeeded(role: ISetup, options: protoCreepOptions): void;
	pathLengthToAssignedRoomStorage: number;
	haulingNeeded: boolean;
}

type Sink = StructureSpawn | StructureExtension | StructureTower;
type StorageUnit = StructureContainer | StructureStorage;

interface Room {
	// brain: any;
	colonyFlag: Flag;
	colony: IColony;
	setColony(colonyName: string): void;
	overlord: IOverlord;
	my: boolean;
	reservedByMe: boolean;
	signedByMe: boolean;
	creeps: Creep[];
	hostiles: Creep[];
	hostileStructures: Structure[];
	flags: Flag[];
	assignedFlags: Flag[];
	remainingConstructionProgress: number;
	// Preprocessed structures
	drops: { [resourceType: string]: Resource[] };
	droppedEnergy: Resource[];
	structures: { [structureType: string]: Structure[] };
	getStructures(structureType: string): Structure[];
	spawns: Spawn[];
	extensions: Extension[];
	containers: StructureContainer[];
	storageUnits: StorageUnit[];
	towers: StructureTower[];
	links: StructureLink[];
	labs: StructureLab[];
	sources: Source[];
	sinks: Sink[];
	repairables: Structure[];
	constructionSites: ConstructionSite[];
	structureSites: ConstructionSite[];
	roadSites: ConstructionSite[];
	barriers: (StructureWall | StructureRampart)[]
	remoteContainers: StructureContainer[];
	sinkContainers: StructureContainer[];
	sinkLinks: StructureLink[];
	run(): void;
}

interface RoomObject {
	log(message: string): void;
	inSameRoomAs(otherObject: RoomObject): boolean;
	ref: string;
	colony: IColony;
	assignedCreepNames: { [role: string]: string };
	getAssignedCreeps(role: string): ICreep[];
	getAssignedCreepAmounts(role: string): number;
	assignedCreepAmounts: { [role: string]: number };
	targetedBy: string[];
	flagged: boolean;
	flaggedWith(filter: Function): boolean;
	linked: boolean;
	links: StructureLink[];
	pathLengthToStorage: number;
	roomName: string;
	pathLengthTo(otherObject: RoomObject): number;
}

interface RoomPosition {
	name: string;
	flagged: boolean;
	getAdjacentPositions(): RoomPosition[];
	flaggedWith(filter: Function): boolean;
	getMultiRoomRangeTo(pos: RoomPosition): number;
	findClosestByLimitedRange<T>(objects: T[] | RoomPosition[], rangeLimit: number,
								 opts?: { filter: any | string; }): T;
}

interface RoomVisual {
	multitext(textArray: string[], x: number, starty: number, fontSize: number, style: any): number;
}

interface StructureContainer {
	energy: number;
	refillThis: boolean;
	miningFlag: Flag;
	miningSite: IMiningSite;
	predictedEnergyOnArrival: number;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureController {
	reservedByMe: boolean;
	signedByMe: boolean;
}

interface StructureExtension {
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureLab {
	assignedMineralType: string;
	IO: string;
	maxAmount: number;
	// isFull: boolean;
	// isEmpty: boolean;
}

interface StructureLink {
	refillThis: boolean;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureNuker {
	// isFull: boolean;
	// isEmpty: boolean;
}

interface StructurePowerSpawn {
	// isFull: boolean;
	// isEmpty: boolean;
}

interface StructureStorage {
	energy: number;
	creepCanWithdrawEnergy(creep: ICreep): boolean;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureSpawn {
	cost(bodyArray: string[]): number;
	uptime: number;
	statusMessage: string;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureTerminal {
	energy: any;
	brain: any;
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
