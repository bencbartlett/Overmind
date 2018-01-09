declare const require: (module: string) => any;
declare var global: any;

interface flagActions {
	[actionType: string]: Function;
}

interface flagSubCat {
	color: number;
	secondaryColor: number;
	filter: Function;
	action: Function | null;
}

interface flagCat {
	color: number;
	filter: Function;
	action: flagActions | null;

	[subcat: string]: any;
}

interface ColorCode {
	color: ColorConstant;
	secondaryColor: ColorConstant;
}

interface Coord {
	x: number;
	y: number;
}

interface StructureMap {
	[structureType: string]: RoomPosition[];
}

interface BuildingPlannerOutput {
	name: string;
	shard: string;
	rcl: string;
	buildings: { [structureType: string]: { pos: Coord[] } };
}

interface StructureLayout {
	[rcl: number]: BuildingPlannerOutput | undefined;

	data: {
		pos: Coord;
	}
}

interface RoomPlan {
	[componentName: string]: {
		map: StructureMap;
		pos: RoomPosition;
		rotation: number;
	}
}

interface IDirective {
	flag: Flag;
	name: string;
	colony: IColony;
	pos: RoomPosition;
	room: Room | undefined;
	memory: FlagMemory;
	overlords: { [name: string]: IOverlord };

	remove(): number;

	setColor(color: ColorConstant, secondaryColor?: ColorConstant): number;

	setPosition(pos: RoomPosition): number;

	init(): void;

	run(): void;
}

interface IOverlordInitializer {
	name: string;
	room: Room | undefined;
	pos: RoomPosition;
	colony: IColony;
	memory: any;
}

interface IOverlord {
	name: string;
	ref: string;
	colony: IColony;
	creeps: { [roleName: string]: Zerg[] };
	memory: OverlordMemory;

	spawn(): void;

	init(): void;

	run(): void;
}

interface protoCreep {
	body: BodyPartConstant[];
	name: string;
	memory: any;
}

interface protoCreepOptions {
	assignment?: RoomObject;
	patternRepetitionLimit?: number;
}

interface protoRoomObject {
	ref: string;
	pos: protoPos;
}

interface protoPos {
	x: number;
	y: number;
	roomName: string;
}

interface TaskOptions {
	blind?: boolean;
	travelToOptions: TravelToOptions;
}

interface protoTask {
	name: string;
	_creep: {
		name: string;
	};
	_target: {
		ref: string;
		_pos: protoPos;
	};
	_parent: protoTask | null;
	settings: {
		targetRange: number;
		moveColor: string;
	};
	options: TaskOptions;
	data: {
		quiet?: boolean;
		resourceType?: string;
	};
}

interface ITask extends protoTask {
	creep: Zerg;
	target: RoomObject | null;
	targetPos: RoomPosition;
	parent: ITask | null;

	fork(newTask: ITask): void

	isValidTask(): boolean;

	isValidTarget(): boolean;

	isValid(): boolean;

	move(): number;

	run(): number;

	work(): number;

	finish(): void;
}

interface IResourceRequest {
	target: EnergyRequestStructure | ResourceRequestStructure;
	amount: number;
	resourceType: string;
}

interface IWithdrawRequest {
	target: EnergyWithdrawStructure | ResourceWithdrawStructure;
	amount: number;
	resourceType: string;
}

type EnergyRequestStructure = Sink | StructureContainer;
type ResourceRequestStructure = StructureLab | StructureNuker | StructurePowerSpawn | StructureContainer;
type EnergyWithdrawStructure = StructureContainer | StructureTerminal | StructureLink;
type ResourceWithdrawStructure = StructureLab | StructureContainer | StructureTerminal;

interface ITransportRequestGroup {
	supply: IResourceRequest[];
	withdraw: IWithdrawRequest[];

	requestEnergy(target: EnergyRequestStructure, amount?: number): void

	requestResource(target: ResourceRequestStructure, resourceType: ResourceConstant, amount?: number): void

	requestWithdrawal(target: EnergyWithdrawStructure, amount?: number): void

	requestResourceWithdrawal(target: ResourceWithdrawStructure, resourceType: ResourceConstant, amount?: number): void
}

interface ILinkRequestGroup {
	receive: StructureLink[];
	transmit: StructureLink[];

	requestReceive(link: StructureLink): void;

	requestTransmit(link: StructureLink): void
}

interface IObjective {
	name: string;
	target: RoomObject;
	pos: RoomPosition;
	ref: string;
	creepNames: string[];
	maxCreeps: number;
	assignableToRoles: string[];

	assignableTo(creep: Zerg): boolean;

	getTask(): ITask;

	assignTo(creep: Zerg): void;
}

interface IObjectiveGroup {
	objectives: { [objectiveName: string]: IObjective[] };
	objectivesByRef: { [objectiveRef: string]: IObjective };
	objectivePriorities: string[];

	registerObjectives(...args: IObjective[][]): void;

	assignTask(creep: Zerg): void;
}



