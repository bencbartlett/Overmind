interface IHiveCluster {
	room: Room;
	pos: RoomPosition;
	componentName: string;
	name: string;
	memory: any;
	overlord: IOverlord | undefined;
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
	overlord: IOverlord;
}

interface IMiningGroup extends IHiveCluster {
	dropoff: StructureLink | StructureStorage;
	links: StructureLink[] | undefined;
	availableLinks: StructureLink[] | undefined;
	miningSites: IMiningSite[];
	parkingSpots: RoomPosition[];
	transportRequests: ITransportRequestGroup;
	data: {
		haulingPowerNeeded: number,
		linkPowerNeeded: number,
		linkPowerAvailable: number,
	};
	overlord: IOverlord;
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
	idlePos: RoomPosition;
	depositStructures: (StructureContainer |
		StructureExtension |
		StructureLab |
		StructureLink |
		StructureNuker |
		StructurePowerSpawn |
		StructureSpawn |
		StructureStorage |
		StructureTower |
		StructureTerminal)[];
	withdrawStructures: (StructureLink | StructureTerminal | StructureStorage)[];
	settings: {
		linksTransmitAt: number;
		refillTowersBelow: number;
		excessEnergyTransferSize: number;
		managerSize: number;
		unloadStorageBuffer: number;
	};
}

interface IHatchery extends IHiveCluster {
	memory: HatcheryMemory;
	spawns: Spawn[];
	availableSpawns: Spawn[];
	extensions: StructureExtension[];
	link: StructureLink | undefined;
	battery: StructureContainer | undefined;
	idlePos: RoomPosition;
	transportRequests: ITransportRequestGroup;

	enqueue(protoCreep: protoCreep, priority: number): void;
}

interface IUpgradeSite extends IHiveCluster {
	controller: StructureController;
	input: StructureLink | StructureContainer | null;
	inputConstructionSite: ConstructionSite | null;
	upgradePowerNeeded: number;
	overlord: IOverlord;
}

