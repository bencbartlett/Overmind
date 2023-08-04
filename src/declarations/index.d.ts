declare const require: (module: string) => any;

declare const MARKET_FEE = 300; // missing in the typed-screeps declarations

declare type NO_ACTION = 1;
declare var NO_ACTION: NO_ACTION = 1;

type TickPhase = 'assimilating' | 'build' | 'refresh' | 'init' | 'run' | 'postRun';
declare var PHASE: TickPhase;
declare var LATEST_BUILD_TICK: number;
declare var LATEST_GLOBAL_RESET_TICK: number;
declare var LATEST_GLOBAL_RESET_DATE: Date;
declare var GLOBAL_AGE: number;

declare var __VERSION__: string;

declare function print(...args: any[]): string;
declare function deref(ref: string): RoomObject | null;
declare function derefRoomPosition(protoPos: ProtoPos): RoomPosition;
declare function gc(quick?: boolean): void;

declare var _cache: IGlobalCache;

declare var PERMACACHE: { [key: string]: any };

declare var __DEFAULT_OVERMIND_SIGNATURE__: string;

declare var remoteDebugger: import('debug/remoteDebugger').RemoteDebugger;

declare var Overmind: IOvermind;

declare var Memory: Memory;
declare var Assimilator: IAssimilator;

declare var Cartographer: import('utilities/Cartographer').Cartographer;
declare var Pathing: import('movement/Pathing').Pathing;
declare var RoomIntel: typeof import('intel/RoomIntel').RoomIntel;
declare var CombatIntel: typeof import('intel/CombatIntel').CombatIntel;
declare var GoalFinder: import('targeting/GoalFinder').GoalFinder;
declare var Abathur: import('resources/Abathur').Abathur;

declare var MatrixCache: import('matrix/MatrixLib').MatrixCache;
declare var MatrixLib: import('matrix/MatrixLib').MatrixLib;

declare var PackratTests: import('utilities/packrat').PackratTests;

declare var CombatCreepSetup: typeof import('creepSetups/CombatCreepSetup').CombatCreepSetup;
declare var DefaultCombatCreepSetups: {[type: string]: any }; // import('creepSetups/CombatCreepSetup').CombatCreepSetup }

type Full<T> = {
	[P in keyof T]-?: T[P];
};

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// declare module 'screeps-profiler'; // I stopped using the typings for this because it was fucking up the Game typings


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
	things: { [key: string]: undefined | _HasId | _HasId[] };
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
	cache: import('caching/GameCache').GameCache;
	overseer: import('Overseer').Overseer;
	directives: { [flagName: string]: import('directives/Directive').Directive };
	zerg: { [creepName: string]: import('zerg/Zerg').Zerg };
	powerZerg: { [creepName: string]: import('zerg/PowerZerg').PowerZerg };
	colonies: { [roomName: string]: import('Colony').Colony };
	overlords: { [ref: string]: import('overlords/Overlord').Overlord };
	spawnGroups: { [ref: string]: import('logistics/SpawnGroup').SpawnGroup };
	colonyMap: { [roomName: string]: string };
	memory: IOvermindMemory;
	terminalNetwork: ITerminalNetwork;			// is actually TerminalNetwork
	tradeNetwork: ITradeNetwork;				// is actually TradeNetwork
	expansionPlanner: import('strategy/ExpansionPlanner').ExpansionPlanner;
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

interface HasRef {
	ref: string;
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


type StoreContentsArray = [resourceType: ResourceConstant, amount: number][];
type StoreContents = { [resourceType in ResourceConstant]: number };
type DropContents = { [resourceType in ResourceConstant]: Resource[] | undefined };
