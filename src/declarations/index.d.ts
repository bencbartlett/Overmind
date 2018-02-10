declare const require: (module: string) => any;
declare var global: any;

declare namespace NodeJS {
	interface Global {
		Overmind: IOvermind;
		log: any;
		Profiler: any;

		deref(ref: string): RoomObject | null;

		derefRoomPosition(protoPos: protoPos): RoomPosition;
	}
}

interface Game {
	zerg: { [name: string]: any };
	directives: { [name: string]: any };
}

interface ICache {
	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };
	structures: { [roomName: string]: { [structureType: string]: Structure[] } };
	constructionSites: { [roomName: string]: ConstructionSite[] };
	structureSites: { [roomName: string]: ConstructionSite[] };
	roadSites: { [roomName: string]: ConstructionSite[] };
	drops: { [roomName: string]: { [resourceType: string]: Resource[] } };

	build(): void;

	rebuild(): void;
}

interface IOvermind {
	cache: ICache;
	Colonies: { [roomName: string]: any };
	overlords: { [overlordName: string]: any };
	colonyMap: { [roomName: string]: string };
	invisibleRooms: string[];

	build(): void;

	// rebuild(): void;

	init(): void;

	run(): void;

	visuals(): void;
}

declare var Overmind: IOvermind;

interface Coord {
	x: number;
	y: number;
}

interface StructureMap {
	[structureType: string]: RoomPosition[];
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

interface HasPos {
	pos: RoomPosition
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
