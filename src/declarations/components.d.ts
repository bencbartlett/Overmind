interface IColony {
	name: string;
	colony: IColony;
	memory: ColonyMemory;
	roomNames: string[];
	room: Room;
	rooms: Room[];
	outposts: Room[];
	pos: RoomPosition;
	overseer: IOverseer;
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
	stage: number;
	// stage: 'larva' | 'pupa' | 'adult';
	// defcon: 0 | 1 | 2 | 3 | 4 | 5;
	flags: Flag[];
	creeps: Zerg[];
	creepsByRole: { [roleName: string]: Zerg[] };
	// creepsByOverseer: { [overseer: string]: Zerg[] };
	hostiles: Creep[];

	overlords: { [name: string]: IOverlord };

	getCreepsByRole(roleName: string): Zerg[];

	sources: Source[];
	linkRequests: ILinkRequestGroup;
	transportRequests: ITransportRequestGroup;				// Box for resource requests
	// data: {
	// 	energyPerTick: number,
	// 	numHaulers: number,
	// 	haulingPowerSupplied: number,
	// 	haulingPowerNeeded: number,
	// }
	// registerIncubation(): void;
	// build(): void;
	init(): void;

	// postInit(): void;
	run(): void;
}

interface IOverseer {
	name: string;
	memory: OverseerMemory;
	// room: Room;
	colony: IColony;
	directives: IDirective[];
	// directives: { [priority: number]: IDirective[] };
	overlords: { [priority: number]: IOverlord[] };
	// settings: {
	// 	incubationWorkersToSend: number;
	// 	storageBuffer: { [role: string]: number };
	// 	unloadStorageBuffer: number;
	// 	maxAssistLifetimePercentage: number;
	// };
	// objectiveGroup: IObjectiveGroup;
	// transportRequests: ITransportRequestGroup;
	init(): void;

	// assignTask(creep: Zerg): void;
	run(): void;
}
