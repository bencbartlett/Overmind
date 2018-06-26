declare const require: (module: string) => any;
declare var global: any;

declare namespace NodeJS {
	interface Global {

		__VERSION__: string;

		Overmind: IOvermind;

		print(...args: any[]): void;

		deref(ref: string): RoomObject | null;

		derefRoomPosition(protoPos: protoPos): RoomPosition;
	}
}

declare module 'screeps-profiler'; // I stopped using the typings for this because it was fucking up the Game typings

declare module 'columnify';

// If TS2451 gets thrown, change "declare let Game: Game;" to "declare var Game: Game;"
// in typed-screeps index.d.ts file. (See issue #61 until the package is updated)
interface Game {
	zerg: { [name: string]: any };
	directives: { [name: string]: any };
}


interface ICache {
	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };
	// structures: { [roomName: string]: { [structureType: string]: Structure[] } };
	// constructionSites: { [roomName: string]: ConstructionSite[] };
	// // structureSites: { [roomName: string]: ConstructionSite[] };
	// // roadSites: { [roomName: string]: ConstructionSite[] };
	// drops: { [roomName: string]: { [resourceType: string]: Resource[] } };

	build(): void;

	rebuild(): void;
}

interface IOvermindMemory {
	terminalNetwork: any;
	versionUpdater: any;
}

interface IOvermind {
	cache: ICache;
	colonies: { [roomName: string]: any };
	overlords: { [overlordName: string]: any };
	colonyMap: { [roomName: string]: string };
	invisibleRooms: string[];
	memory: IOvermindMemory;
	terminalNetwork: ITerminalNetwork;
	tradeNetwork: ITradeNetwork;

	build(): void;

	// rebuild(): void;

	init(): void;

	run(): void;

	visuals(): void;
}


interface TerminalState {
	amounts: { [resourceType: string]: number },
	tolerance: number
}

interface ITerminalNetwork {
	terminals: StructureTerminal[];
	memory: any;

	requestResource(terminal: StructureTerminal, resourceType: ResourceConstant, amount: number): void;

	registerTerminalState(terminal: StructureTerminal, state: TerminalState): void

	init(): void;

	run(): void;
}

interface ITradeNetwork {
	memory: any;

	priceOf(mineralType: ResourceConstant): number

	lookForGoodDeals(terminal: StructureTerminal, mineral: string, margin?: number): void;

	sellDirectly(terminal: StructureTerminal, resource: ResourceConstant, amount?: number): void;

	sell(terminal: StructureTerminal, resource: ResourceConstant, amount?: number): void;

	buyMineral(terminal: StructureTerminal, mineralType: ResourceConstant, amount: number): void;

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

// interface StoreLike {
// 	[resourceType: string]: number
// }

