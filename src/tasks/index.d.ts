interface TaskSettings {
	targetRange: number;
	workOffRoad: boolean;
	oneShot: boolean;
}

interface TaskOptions {
	blind?: boolean;
	nextPos?: protoPos;
	travelToOptions?: TravelToOptions;
}

interface TaskData {
	quiet?: boolean;
	resourceType?: string;
	amount?: number;

	[other: string]: any;
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
	tick: number;
	options: TaskOptions;
	data: TaskData;
}

interface ITask extends protoTask {
	settings: TaskSettings;
	proto: protoTask;
	creep: Creep;
	target: RoomObject | null;
	targetPos: RoomPosition;
	parent: ITask | null;
	manifest: ITask[];
	targetManifest: (RoomObject | null)[];
	targetPosManifest: RoomPosition[];
	eta: number | undefined;

	fork(newTask: ITask): ITask;

	isValidTask(): boolean;

	isValidTarget(): boolean;

	isValid(): boolean;

	move(): number;

	moveToNextPos(): number | undefined;

	run(): number | void;

	work(): number;

	finish(): void;
}

// interface CreepMemory {
// 	task: protoTask | null;
// }

interface Creep {
	task: ITask | null;
	hasValidTask: boolean;
	isIdle: boolean;

	run(): number | void;
}