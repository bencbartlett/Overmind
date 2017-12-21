interface IColony {
	name: string;
	memory: ColonyMemory;
	roomNames: string[];
	room: Room;
	overlord: IOverlord;
	controller: StructureController;
	spawns: StructureSpawn[];
	extensions: StructureExtension[];
	storage: StructureStorage | undefined;
	links: StructureLink[];
	terminal: StructureTerminal | undefined;
	towers: StructureTower[];
	labs: StructureLab[];
	powerSpawn: StructurePowerSpawn | undefined;
	nuker: StructureNuker | undefined;
	observer: StructureObserver | undefined;
	commandCenter: ICommandCenter | undefined;
	hatchery: IHatchery | undefined;
	upgradeSite: IUpgradeSite;
	claimedLinks: StructureLink[];
	unclaimedLinks: StructureLink[];
	miningGroups: { [structID: string]: IMiningGroup } | undefined;
	miningSites: { [sourceID: string]: IMiningSite };
	// incubating: boolean;
	incubator: IColony | undefined;
	isIncubating: boolean;
	incubatingColonies: IColony[];
	outposts: Room[];
	rooms: Room[];
	stage: 'larva' | 'pupa' | 'adult';
	defcon: 0 | 1 | 2 | 3 | 4 | 5;
	flags: Flag[];
	creeps: ICreep[];
	creepsByRole: { [roleName: string]: ICreep[] };
	creepsByOverseer: { [overseer: string]: ICreep[] };
	hostiles: Creep[];
	getCreepsByRole(roleName: string): ICreep[];
	sources: Source[];
	data: {
		energyPerTick: number,
		numHaulers: number,
		haulingPowerSupplied: number,
		haulingPowerNeeded: number,
	}
	// registerIncubation(): void;
	build(): void;
	init(): void;
	// postInit(): void;
	run(): void;
}

interface IOverlord {
	name: string;
	memory: OverlordMemory;
	room: Room;
	colony: IColony;
	directives: IDirective[];
	settings: {
		incubationWorkersToSend: number;
		storageBuffer: { [role: string]: number };
		unloadStorageBuffer: number;
		maxAssistLifetimePercentage: number;
	};
	objectiveGroup: IObjectiveGroup;
	resourceRequests: IResourceRequestGroup;
	init(): void;
	assignTask(creep: ICreep): void;
	run(): void;
}
