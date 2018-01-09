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
	incubator: IColony | undefined;
	isIncubating: boolean;
	incubatingColonies: IColony[];
	stage: number;
	flags: Flag[];
	creeps: Zerg[];
	creepsByRole: { [roleName: string]: Zerg[] };
	hostiles: Creep[];
	overlords: { [name: string]: IOverlord };
	sources: Source[];
	linkRequests: ILinkRequestGroup;
	transportRequests: ITransportRequestGroup;

	// build(): void;

	getCreepsByRole(roleName: string): Zerg[];

	init(): void;

	run(): void;
}

interface IOverseer {
	name: string;
	memory: OverseerMemory;
	colony: IColony;
	directives: IDirective[];
	overlords: { [priority: number]: IOverlord[] };

	init(): void;

	run(): void;
}
