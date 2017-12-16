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
	colony: IColony | undefined;
	colonyName: string | undefined;
	assignedTo: string | undefined;
	pos: RoomPosition;
	room: Room | undefined;
	memory: FlagMemory;
	color: ColorConstant;
	secondaryColor: ColorConstant;

	remove(): number;

	setColor(color: ColorConstant, secondaryColor?: ColorConstant): number;

	setPosition(pos: RoomPosition): number;

	getAssignedCreeps(roleName: string): ICreep[];

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
	data: {
		quiet: boolean;
		travelToOptions: any;
		resourceType?: string;
	};
}

interface ITask extends protoTask {
	creep: ICreep;
	target: RoomObject | null;
	targetPos: RoomPosition;
	parent: ITask | null;

	fork(newTask: ITask): void

	isValidTask(): boolean;

	isValidTarget(): boolean;

	move(): number;

	run(): number;

	work(): number;

	finish(): void;
}

interface IResourceRequest {
	target: StructureLink | StructureContainer;
	amount: number;
	resourceType: string;
}

interface IResourceRequestGroup {
	resourceIn: {
		haul: IResourceRequest[],
		link: IResourceRequest[]
	};
	resourceOut: {
		haul: IResourceRequest[],
		link: IResourceRequest[]
	};

	registerResourceRequest(target: StructureLink | StructureContainer, resourceType?: string): void;

	registerWithdrawalRequest(target: StructureLink | StructureContainer, resourceType?: string): void;
}

interface IObjective {
	name: string;
	target: RoomObject;
	pos: RoomPosition;
	ref: string;
	creepNames: string[];
	maxCreeps: number;
	assignableToRoles: string[];

	assignableTo(creep: ICreep): boolean;

	getTask(): ITask;

	assignTo(creep: ICreep): void;
}

interface IObjectiveGroup {
	objectives: { [objectiveName: string]: IObjective[] };
	objectivesByRef: { [objectiveRef: string]: IObjective };
	objectivePriorities: string[];

	registerObjectives(...args: IObjective[][]): void;

	assignTask(creep: ICreep): void;
}



