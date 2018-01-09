interface Zerg {
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
	task: ITask | null;
	hasValidTask: boolean;
	isIdle: boolean;
	colony: IColony;
	lifetime: number;
	moveSpeed: number;
	overlord: IOverlord | null;

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

	signController(target: StructureController, text: string): number;

	suicide(): number;

	upgradeController(controller: StructureController): number;

	heal(target: Creep | Zerg): number;

	rangedHeal(target: Creep | Zerg): number;

	transfer(target: Creep | Zerg | Structure, resourceType: string, amount?: number): number;

	withdraw(target: Creep | Zerg | Structure, resourceType: string, amount?: number): number;

	travelTo(destination: RoomPosition | { pos: RoomPosition }, options?: any): number;

	initializeTask(protoTask: protoTask): ITask | null;

	getBodyparts(partType: string): number;

	run(): number | void;
}
