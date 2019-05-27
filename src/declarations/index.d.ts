declare const require: (module: string) => any;
declare var global: any;

declare namespace NodeJS {
	interface Global {

		age?: number;

		_cache: IGlobalCache;

		__VERSION__: string;

		Overmind: IOvermind;

		Assimilator: IAssimilator;

		print(...args: any[]): string;

		deref(ref: string): RoomObject | null;

		derefRoomPosition(protoPos: ProtoPos): RoomPosition;

		gc(quick?: boolean): void;
	}
}

// declare module 'screeps-profiler'; // I stopped using the typings for this because it was fucking up the Game typings

declare module 'columnify';

// If TS2451 gets thrown, change "declare let Game: Game;" to "declare var Game: Game;"
// in typed-screeps index.d.ts file. (See issue #61 until the package is updated)
interface Game {
	// zerg: { [name: string]: any };
	// directives: { [name: string]: any };
}


interface IGlobalCache {
	accessed: { [key: string]: number };
	expiration: { [key: string]: number };
	structures: { [key: string]: Structure[] };
	numbers: { [key: string]: number };
	lists: { [key: string]: any[] };
	costMatrices: { [key: string]: CostMatrix };
	roomPositions: { [key: string]: RoomPosition | undefined };
	things: { [key: string]: undefined | HasID | HasID[] };
	// objects: { [key: string]: Object };
}

interface ICache {
	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	creepsByColony: { [colonyName: string]: Creep[] };
	targets: { [ref: string]: string[] };
	outpostFlags: Flag[];

	build(): void;

	refresh(): void;
}

interface IExpansionPlanner {

	refresh(): void;

	init(): void;

	run(): void;

}

interface IOvermindMemory {
	terminalNetwork: any;
	versionUpdater: any;
}

declare const Assimilator: IAssimilator;

interface IAssimilator {

	validate(code: any): void;

	generateChecksum(): string;

	updateValidChecksumLedger(): void;

	isAssimilated(username: string): boolean;

	getClearanceCode(username: string): string | null;

	run(): void;

}

interface IOvermind {
	shouldBuild: boolean;
	expiration: number;
	cache: ICache;								// is actually GameCache
	overseer: IOverseer;						// is actually Overseer
	directives: { [flagName: string]: any }; 	// is actually { [flagName: string]: Directive }
	zerg: { [creepName: string]: any };			// is actually { [creepName: string]: Zerg }
	colonies: { [roomName: string]: any }; 		// is actually { [roomName: string]: Colony }
	overlords: { [ref: string]: any }; 			// is actually { [ref: string]: Overlord }
	spawnGroups: { [ref: string]: any };		// is actually { [ref: string]: SpawnGroup }
	colonyMap: { [roomName: string]: string };
	memory: IOvermindMemory;
	terminalNetwork: ITerminalNetwork;			// is actually TerminalNetwork
	tradeNetwork: ITradeNetwork;				// is actually TradeNetwork
	expansionPlanner: IExpansionPlanner;
	exceptions: Error[];

	build(): void;

	refresh(): void;

	init(): void;

	run(): void;

	postRun(): void;

	visuals(): void;
}

interface INotifier {
	alert(message: string, roomName: string, priority?: number): void;

	generateNotificationsList(links: boolean): string[];

	visuals(): void;
}

interface IOverseer {

	notifier: INotifier;

	registerDirective(directive: any): void;

	removeDirective(directive: any): void;

	registerOverlord(overlord: any): void;

	getOverlordsForColony(colony: any): any[];

	isOverlordSuspended(overlord: any): boolean;

	suspendOverlordFor(overlord: any, ticks: number): void;

	suspendOverlordUntil(overlord: any, untilTick: number): void;

	init(): void;

	run(): void;

	getCreepReport(colony: any): string[][];

	visuals(): void;
}


interface TerminalState {
	name: string;
	type: 'in' | 'out' | 'in/out';
	amounts: { [resourceType: string]: number };
	tolerance: number;
}

interface ITerminalNetwork {
	allTerminals: StructureTerminal[];
	readyTerminals: StructureTerminal[];
	// terminals: StructureTerminal[];
	memory: any;

	refresh(): void;

	requestResource(terminal: StructureTerminal, resourceType: ResourceConstant, amount: number): void;

	registerTerminalState(terminal: StructureTerminal, state: TerminalState): void;

	init(): void;

	run(): void;
}

interface ITradeNetwork {
	memory: any;

	refresh(): void;

	priceOf(mineralType: ResourceConstant): number;

	lookForGoodDeals(terminal: StructureTerminal, mineral: string, margin?: number): void;

	sellDirectly(terminal: StructureTerminal, resource: ResourceConstant, amount?: number,
				 flexibleAmount?: boolean): number | undefined;

	sell(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
		 maxOrdersOfType?: number): number | undefined;

	buy(terminal: StructureTerminal, mineralType: ResourceConstant, amount: number): void;

	maintainBuyOrder(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
					 maxOrdersOfType?: number): void;

	init(): void;

	run(): void;
}

declare var Overmind: IOvermind;

declare var _cache: IGlobalCache;

declare function print(...args: any[]): void;

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

interface PathFinderGoal {
	pos: RoomPosition;
	range: number;
	cost?: number;
}

interface ProtoCreep {
	body: BodyPartConstant[];
	name: string;
	memory: any;
}

interface ProtoCreepOptions {
	assignment?: RoomObject;
	patternRepetitionLimit?: number;
}

interface ProtoRoomObject {
	ref: string;
	pos: ProtoPos;
}

interface ProtoPos {
	x: number;
	y: number;
	roomName: string;
}

interface HasPos {
	pos: RoomPosition;
}

interface HasRef {
	ref: string;
}

interface HasID {
	id: string;
}

// interface StoreLike {
// 	[resourceType: string]: number
// }

