interface TaskSettings {
	targetRange: number;
	workOffRoad: boolean;
	oneShot: boolean;
	timeout: number;
	blind: boolean;
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
