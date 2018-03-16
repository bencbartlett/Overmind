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
	profiler: ScreepsGameProfiler;
}


interface ScreepsGameProfiler {

	profile(ticks: number, functionFilter?: string): void;

	stream(ticks: number, functionFilter?: string): void;

	email(ticks: number, functionFilter?: string): void;

	background(functionFilter?: string): void;

	output(lineCount?: number): void;

	reset(): void;

	restart(): void;
}

interface ScreepsProfilerStatic {


}

declare module 'screeps-profiler' {
	export function enable(): void;

	export function wrap(callback: Function): Function;

	export function registerClass(constructor: Function, className: string): void;

	export function registerObject(object: any, objectName: string): void;

	export function registerFN(fn: Function, fnName?: string): Function;
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

