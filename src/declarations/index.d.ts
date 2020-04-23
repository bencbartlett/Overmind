declare const require: (module: string) => any;
declare var global: any;

declare const MARKET_FEE: 300; // missing in the typed-screeps declarations
global.MARKET_FEE = MARKET_FEE;

declare const NO_ACTION: 1;
declare type NO_ACTION = NO_ACTION;
global.NO_ACTION = NO_ACTION;

type TickPhase = 'assimilating' | 'build' | 'refresh' | 'init' | 'run' | 'postRun';
declare var PHASE: TickPhase;
declare var LATEST_BUILD_TICK: number;
declare var LATEST_GLOBAL_RESET_TICK: number;
declare var LATEST_GLOBAL_RESET_DATE: Date;

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

type Full<T> = {
	[P in keyof T]-?: T[P];
};

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// declare module 'screeps-profiler'; // I stopped using the typings for this because it was fucking up the Game typings

declare module 'columnify';

// If TS2451 gets thrown, change "declare let Game: Game;" to "declare var Game: Game;"
// in typed-screeps index.d.ts file. (See issue #61 until the package is updated)
interface Game {
	_allRooms?: Room[];
	_ownedRooms?: Room[];
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

// interface IOvermindMemory {
// 	terminalNetwork: any;
// 	versionUpdater: any;
// }

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
	powerZerg: { [creepName: string]: any };	// is actually { [creepName: string]: PowerZerg }
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

	getDirectivesOfType(directiveName: string): any[];

	getDirectivesInRoom(roomName: string): any[];

	getDirectivesForColony(colony: {name: string}): any[];

	registerOverlord(overlord: any): void;

	getOverlordsForColony(colony: any): any[];

	init(): void;

	run(): void;

	getCreepReport(colony: any): string[][];

	visuals(): void;
}


// interface TerminalState {
// 	name: string;
// 	type: 'in' | 'out' | 'in/out';
// 	amounts: { [resourceType: string]: number };
// 	tolerance: number;
// }

interface Thresholds {
	target: number;
	surplus: number | undefined;
	tolerance: number;
}

interface ITerminalNetwork {

	addColony(colony: IColony): void;

	refresh(): void;

	getAssets(): { [resourceType: string]: number };

	thresholds(colony: IColony, resource: ResourceConstant): Thresholds;

	canObtainResource(requestor: IColony, resource: ResourceConstant, totalAmount: number): boolean;

	requestResource(requestor: IColony, resource: ResourceConstant, totalAmount: number, tolerance?: number): void;

	lockResource(requestor: IColony, resource: ResourceConstant, lockedAmount: number): void;

	exportResource(provider: IColony, resource: ResourceConstant, thresholds?: Thresholds): void;

	init(): void;

	run(): void;
}


interface TradeOpts {
	preferDirect?: boolean;			// true if you prefer to sell directly via a .deal() call
	flexibleAmount?: boolean;		// true if you're okay filling the transaction with several smaller transactions
	ignoreMinAmounts?: boolean;		// true if you want to ignore quantity checks (e.g. T5 commodities in small amounts)
	ignorePriceChecksForDirect?: boolean; 	// true if you want to bypass price sanity checks when .deal'ing
	dryRun?: boolean; 				// don't actually execute the trade, just check to see if you can make it
}

interface ITradeNetwork {
	memory: any;

	refresh(): void;

	getExistingOrders(type: ORDER_BUY | ORDER_SELL, resource: ResourceConstant | 'any', roomName?: string): Order[];

	priceOf(resource: ResourceConstant): number;

	ordersProcessedThisTick(): boolean;

	buy(terminal: StructureTerminal, resource: ResourceConstant, amount: number, opts?: TradeOpts): number;

	sell(terminal: StructureTerminal, resource: ResourceConstant, amount: number, opts?: TradeOpts): number;

	init(): void;

	run(): void;
}

declare var Overmind: IOvermind;

declare var _cache: IGlobalCache;

declare var PERMACACHE: { [key: string]: any };

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
	id: Id;
}

type AnyStoreStructure =
	StructureContainer
	| StructureExtension
	| StructureFactory
	| StructureLab
	| StructureLink
	| StructureNuker
	| StructurePowerSpawn
	| StructureSpawn
	| StructureStorage
	| StructureTerminal
	| StructureTower
	| Ruin
	| Tombstone;

type TransferrableStoreStructure =
	StructureContainer
	| StructureExtension
	| StructureFactory
	| StructureLab
	| StructureLink
	| StructureNuker
	| StructurePowerSpawn
	| StructureSpawn
	| StructureStorage
	| StructureTerminal
	| StructureTower;

// interface StoreLike {
// 	[resourceType: string]: number
// }

