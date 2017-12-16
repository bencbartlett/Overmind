interface IHiveCluster {
	colonyName: string;
	room: Room;
	pos: RoomPosition;
	componentName: string;
	ref: string;
	overlord: IOverlord;
	colony: IColony;
	init(): void;
	run(): void;
}

interface IMiningSite extends IHiveCluster {
	source: Source;
	energyPerTick: number;
	miningPowerNeeded: number;
	output: StructureContainer | StructureLink | undefined;
	outputConstructionSite: ConstructionSite | undefined;
	miningGroup: IMiningGroup | undefined;
	predictedStore: number;
	miners: ICreep[];
}

interface IMiningGroup extends IHiveCluster {
	dropoff: StructureLink | StructureStorage;
	links: StructureLink[] | undefined;
	availableLinks: StructureLink[] | undefined;
	miningSites: IMiningSite[];
	parkingSpots: RoomPosition[];
	objectiveGroup: IObjectiveGroup;
	resourceRequests: IResourceRequestGroup;
	data: {
		numHaulers: number,
		haulingPowerSupplied: number,
		haulingPowerNeeded: number,
		linkPowerNeeded: number,
		linkPowerAvailable: number,
	};
}

interface ICommandCenter extends IHiveCluster {
	memory: CommandCenterMemory;
	storage: StructureStorage;
	link: StructureLink | undefined;
	terminal: StructureTerminal | undefined;
	towers: StructureTower[];
	labs: StructureLab[];
	powerSpawn: StructurePowerSpawn | undefined;
	nuker: StructureNuker | undefined;
	observer: StructureObserver | undefined;
	manager: ICreep | undefined;
	idlePos: RoomPosition;
}

interface IHatchery extends IHiveCluster {
	memory: HatcheryMemory;
	spawns: Spawn[];
	availableSpawns: Spawn[];
	extensions: StructureExtension[];
	link: StructureLink | undefined;
	battery: StructureContainer | undefined;
	objectiveGroup: IObjectiveGroup;
	spawnPriorities: { [role: string]: number };
	queen: ICreep | undefined;
	idlePos: RoomPosition;
	emergencyMode: boolean;
	enqueue(protoCreep: protoCreep, priority?: number): void;
}

interface IUpgradeSite extends IHiveCluster {
	controller: StructureController;
	input: StructureLink | StructureContainer | null;
	inputConstructionSite: ConstructionSite | null;
}

