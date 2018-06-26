interface MoveOptions {
	ignoreCreeps?: boolean;
	preferHighway?: boolean;
	allowHostile?: boolean;
	avoidSK?: boolean;
	range?: number;
	obstacles?: RoomPosition[];
	returnData?: TravelToReturnData;
	restrictDistance?: number;
	useFindRoute?: boolean;
	maxOps?: number;
	movingTarget?: boolean;
	freshMatrix?: boolean;
	direct?: boolean;
	terrainCosts?: { plainCost: number, swampCost: number };
	stuckValue?: number;
	maxRooms?: number;
	repath?: number;
	route?: { [roomName: string]: boolean };
	ensurePath?: boolean;
	// pushy?: boolean;
}

interface MoveData {
	state: any[];
	path: string;
	delay?: number;
	priority?: number;
}

interface MoveState {
	stuckCount: number;
	lastCoord: Coord;
	destination: RoomPosition;
	cpu: number;
}
