interface MoveOptions {
	ignoreRoads?: boolean;
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
	offRoad?: boolean;
	stuckValue?: number;
	maxRooms?: number;
	repath?: number;
	route?: { [roomName: string]: boolean };
	ensurePath?: boolean;
}

interface MoveData {
	state: any[];
	path: string;
}

interface MoveState {
	stuckCount: number;
	lastCoord: Coord;
	destination: RoomPosition;
	cpu: number;
}
