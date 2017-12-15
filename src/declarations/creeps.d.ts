interface ISetup {
	name: string;
	body: {
		pattern: BodyPartConstant[];
		prefix: BodyPartConstant[];
		suffix: BodyPartConstant[];
		proportionalPrefixSuffix: boolean;
		ordered: boolean;
	}
	bodyPatternCost: number;
	bodyCost(bodyArray: string[]): number;
	generateBody(availableEnergy: number, maxRepeats?: number): string[];
	generateLargestCreep(colony: IColony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep;
	onCreate(pCreep: protoCreep): protoCreep;
	create(colony: IColony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep;
}


interface ICreep {
	// Creep properties
	creep: Creep;
	body: BodyPartDefinition[];
	carry: StoreDefinition;
	carryCapacity: number;
	fatigue: number;
	hits: number;
	hitsMax: number;
	id: string;
	memory: CreepMemory;
	name: string;
	pos: RoomPosition;
	ref: string;
	roleName: string;
	room: Room;
	spawning: boolean;
	ticksToLive: number;
	// Custom properties
	settings: any;
	task: ITask | null;
	// Creep methods
	attack(target: Creep | Structure): number;
	attackController(controller: StructureController): number;
	build(target: ConstructionSite): number;
	claimController(controller: StructureController): number;
	dismantle(target: Structure): number;
	drop(resourceType: string, amount?: number): number;
	getActiveBodyparts(type: string): number;
	harvest(source: Source | Mineral): number;
	move(direction: number): number;
	pickup(resource: Resource): number;
	rangedAttack(target: Creep | Structure): number;
	rangedMassAttack(): number;
	repair(target: Structure): number;
	reserveController(controller: StructureController): number;
	say(message: string, pub?: boolean): number;
	signController(target: Controller, text: string): number;
	suicide(): number;
	upgradeController(controller: StructureController): number;
	heal(target: Creep | ICreep): number;
	rangedHeal(target: Creep | ICreep): number;
	transfer(target: Creep | ICreep | Structure, resourceType: string, amount?: number): number;
	withdraw(target: Creep | ICreep | Structure, resourceType: string, amount?: number): number;
	travelTo(destination: RoomPosition | { pos: RoomPosition }, options?: any): number;
	// Custom creep methods
	initializeTask(protoTask: protoTask): ITask | null;
	hasValidTask: boolean;
	isIdle: boolean;
	assertValidTask(): void;
	// assign(task: ITask): void;
	colony: IColony;
	lifetime: number;
	moveSpeed: number;
	needsReplacing: boolean;
	getBodyparts(partType: string): number;
	sayLoop(sayList: string[]): void;
	repairNearbyDamagedRoad(): number;
	assignment: RoomObject | null;
	assignmentPos: RoomPosition | null;
	inAssignedRoom: boolean;
	assignedRoomFlag: Flag | null;
	objective: IObjective | null;
	requestTask(): void;
	recharge(): void;
	newTask(): void;
	executeTask(): number | void;
	// renewIfNeeded(): void;
	onRun(): void;
	init(): void;
	run(): void;
}
