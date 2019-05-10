interface TaskSettings {
	targetRange: number;
	workOffRoad: boolean;
	oneShot: boolean;
	timeout: number;
	blind: boolean;
}

interface TaskOptions {
	blind?: boolean;
	nextPos?: ProtoPos;
	// moveOptions?: MoveOptions;
}

interface TaskData {
	quiet?: boolean;
	resourceType?: string;
	amount?: number;

	[other: string]: any;
}

interface ProtoTask {
	name: string;
	_creep: {
		name: string;
	};
	_target: {
		ref: string;
		_pos: ProtoPos;
	};
	_parent: ProtoTask | null;
	tick: number;
	options: TaskOptions;
	data: TaskData;
}
