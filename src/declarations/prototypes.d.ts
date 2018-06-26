interface Creep {
	memory: CreepMemory;
	boosts: _ResourceConstantSansEnergy[];
	boostCounts: { [boostType: string]: number };
}

interface ConstructionSite {
	isWalkable: boolean;
}

interface Flag {
	// recalculateColony(restrictDistance?: number): void;
}

type Sink = StructureSpawn |
	StructureExtension |
	StructureLab |
	StructurePowerSpawn |
	StructureNuker |
	StructureTower;
type StorageUnit = StructureContainer | StructureTerminal | StructureStorage;

interface Room {
	print: string;
	my: boolean;
	reservedByMe: boolean;
	signedByMe: boolean;
	creeps: Creep[];
	hostiles: Creep[];
	dangerousHostiles: Creep[];
	playerHostiles: Creep[];
	dangerousPlayerHostiles: Creep[];
	hostileStructures: Structure[];
	flags: Flag[];
	// Cached structures
	tombstones: Tombstone[];
	drops: { [resourceType: string]: Resource[] };
	droppedEnergy: Resource[];
	// droppedMinerals: Resource[];
	droppedPower: Resource[];
	// Room structures
	_refreshStructureCache
	// Multiple structures
	spawns: StructureSpawn[];
	extensions: StructureExtension[];
	roads: StructureRoad[];
	walls: StructureWall[];
	constructedWalls: StructureWall[];
	ramparts: StructureRampart[];
	barriers: (StructureWall | StructureRampart)[];
	keeperLairs: StructureKeeperLair[];
	portals: StructurePortal[];
	links: StructureLink[];
	towers: StructureTower[];
	labs: StructureLab[];
	containers: StructureContainer[];
	powerBanks: StructurePowerBank[];
	// Single structures
	observer: StructureObserver | undefined;
	powerSpawn: StructurePowerSpawn | undefined;
	extractor: StructureExtractor | undefined;
	nuker: StructureNuker | undefined;
	repairables: Structure[];

	sources: Source[];
	mineral: Mineral | undefined;
	constructionSites: ConstructionSite[];
	// Used by movement library
	_defaultMatrix: CostMatrix;
	_creepMatrix: CostMatrix;
	_skMatrix: CostMatrix;
}

interface RoomObject {
	ref: string;
	targetedBy: string[];
	linked: boolean;
	nearbyLinks: StructureLink[];

	// isTargetFor(taskName?: string): ITask[];

	serialize(): protoRoomObject;
}

interface RoomPosition {
	print: string;
	printPlain: string;
	room: Room | undefined;
	name: string;
	coordName: string;
	isEdge: boolean;
	isVisible: boolean;
	rangeToEdge: number;
	roomCoords: Coord;
	neighbors: RoomPosition[];
	// adjacentSpots: RoomPosition[];
	// availableAdjacentSpots: RoomPosition[];
	getPositionsAtRange(range: number, includeWalls?: boolean, includeEdges?: boolean): RoomPosition[];

	getPositionsInRange(range: number, includeWalls?: boolean, includeEdges?: boolean): RoomPosition[];

	lookForStructure(structureType: StructureConstant): Structure | undefined;

	isWalkable(ignoreCreeps?: boolean): boolean;

	availableNeighbors(ignoreCreeps?: boolean): RoomPosition[];

	getPositionAtDirection(direction: DirectionConstant, range?: number): RoomPosition;

	getMultiRoomRangeTo(pos: RoomPosition): number;

	findClosestByLimitedRange<T>(objects: T[] | RoomPosition[], rangeLimit: number,
								 opts?: { filter: any | string; }): T;

	findClosestByMultiRoomRange<T extends _HasRoomPosition>(objects: T[]): T;

	findClosestByRangeThenPath<T extends _HasRoomPosition>(objects: T[]): T;
}

interface RoomVisual {
	infoBox(info: string[], x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	multitext(textLines: string[], x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	structure(x: number, y: number, type: string, opts?: { [option: string]: any }): RoomVisual;

	connectRoads(opts?: { [option: string]: any }): RoomVisual | void;

	speech(text: string, x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	animatedPosition(x: number, y: number, opts?: { [option: string]: any }): RoomVisual;

	test(): RoomVisual;
}

interface Structure {
	isWalkable: boolean;
}

interface StructureContainer {
	energy: number;
	isFull: boolean;
	isEmpty: boolean;
}

interface StructureController {
	reservedByMe: boolean;
	signedByMe: boolean;
	signedByScreeps: boolean;

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

interface StructureStorage {
	energy: number;
	isFull: boolean;
	isEmpty: boolean;

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
	// _send(resourceType: ResourceConstant, amount: number, destination: string, description?: string): ScreepsReturnCode;
}

interface StructureTower {
	isFull: boolean;
	isEmpty: boolean;

	// run(): void;
	//
	// attackNearestEnemy(): number;
	//
	// healNearestAlly(): number;
	//
	// repairNearestStructure(): number;
	//
	// preventRampartDecay(): number;
}

interface Tombstone {
	energy: number;
}

interface String {
	padRight(length: number, char?: string): string;

	padLeft(length: number, char?: string): string;
}

interface Number {
	toPercent(decimals?: number): string;

	truncate(decimals: number): number;
}
