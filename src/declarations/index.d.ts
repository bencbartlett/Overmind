declare const require: (module: string) => any;
declare var global: any;

declare namespace NodeJS {
	interface Global {
		Overmind: IOvermind;
		log: any;

		// Profiler: any;

		deref(ref: string): RoomObject | null;

		derefRoomPosition(protoPos: protoPos): RoomPosition;
	}
}


// If TS2451 gets thrown, change "declare let Game: Game;" to "declare var Game: Game;"
// in typed-screeps index.d.ts file. (See issue #61 until the package is updated)
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

interface IOvermindMemory {
	terminalNetwork: any;
}

interface IOvermind {
	cache: ICache;
	Colonies: { [roomName: string]: any };
	overlords: { [overlordName: string]: any };
	colonyMap: { [roomName: string]: string };
	invisibleRooms: string[];
	memory: IOvermindMemory;
	terminalNetwork: ITerminalNetwork;
	build(): void;

	// rebuild(): void;

	init(): void;

	run(): void;

	visuals(): void;
}

interface ITerminalNetwork {
	// terminals: StructureTerminal[];
	memory: any;

	requestResource(resourceType: ResourceConstant, terminal: StructureTerminal, amount?: number): void;

	init(): void;

	run(): void;
}

declare var Overmind: IOvermind;

interface Coord {
	x: number;
	y: number;
}

interface RoomCoord {
	x: number;
	y: number;
	xDir: string;
	yDir: string;
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

