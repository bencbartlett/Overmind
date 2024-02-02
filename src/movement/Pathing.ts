import {log} from '../console/log';
import {hasPos} from '../declarations/typeGuards';
import {PortalInfo, RoomIntel} from '../intel/RoomIntel';
import {getDefaultMatrixOptions, MatrixLib, MatrixOptions, VolatileMatrixOptions} from '../matrix/MatrixLib';
import {profile} from '../profiler/decorator';
import {packPos, packPosList} from '../utilities/packrat';
import {isAlly, minBy} from '../utilities/utils';
import {Visualizer} from '../visuals/Visualizer';
import {AnyZerg} from '../zerg/AnyZerg';
import {normalizePos} from './helpers';
import {SwarmMoveOptions} from './Movement';


export type FIND_EXIT_PORTAL = 42;
export const FIND_EXIT_PORTAL: FIND_EXIT_PORTAL = 42;
export type AnyExitConstant = FIND_EXIT_TOP | FIND_EXIT_RIGHT | FIND_EXIT_BOTTOM | FIND_EXIT_LEFT | FIND_EXIT_PORTAL;

const DEFAULT_MAXOPS = 20000; // default timeout for pathfinding
const CREEP_COST = 0xfe;
const SK_COST = 10; // add this cost time (range-5) to approaching SK lairs if avoidSK is true
const PORTAL_COST = 25; // don't want to set this too high or it'll spend a bunch of time searching around it

export type Route = { exit: AnyExitConstant, room: string }[];

export interface TerrainCosts {
	plainCost: number;
	swampCost: number;
}

export interface PathingReturn extends PathFinderPath {
	route: Route | undefined;
	usesPortals: boolean;
	portalUsed: PortalInfo | undefined;
}

export const MatrixTypes = {
	direct       : 'dir',
	default      : 'def',
	sk           : 'sk',
	obstacle     : 'obst',
	preferRampart: 'preframp',
	nearRampart  : 'nearRamp'
};

export interface PathOptions {
	range?: number;
	fleeRange?: number;							// range to flee from targets
	terrainCosts?: TerrainCosts;				// terrain costs, determined automatically for creep body if unspecified
	roadCost?: number | 'auto' | 'ignore';		// road costs; 'auto' = set to ceil(plain/2); 'ignore' = ignore roads
	obstacles?: RoomPosition[];					// don't path through these room positions
	blockExits?: boolean;						// ensures you stay in the room you're currently in
	blockCreeps?: boolean;						// ignore pathing around creeps
	ignoreStructures?: boolean;					// ignore pathing around structures
	allowHostile?: boolean;						// allow to path through hostile rooms; origin/destination room excluded
	avoidSK?: boolean;							// avoid walking within range 4 of source keepers
	allowPortals?: boolean;						// allow pathing through portals
	usePortalThreshold?: number;				// skip portal search unless desination is at least this many rooms away
	portalsMustBeInRange?: number | undefined;	// portals must be within this many rooms to be considered for search
	route?: Route;								// manually supply the map route to take
	maxRooms?: number;							// maximum number of rooms to path through
	useFindRoute?: boolean;						// whether to use the route finder; determined automatically otherwise
	maxOps?: number;							// pathfinding times out after this many operations
	ensurePath?: boolean;						// can be useful if route keeps being found as incomplete
	modifyRoomCallback?: (r: Room, m: CostMatrix) => CostMatrix; // modifications to default cost matrix calculations
}

export const getDefaultPathOptions: () => PathOptions = () => ({
	range               : 1,
	terrainCosts        : {plainCost: 1, swampCost: 5},
	roadCost            : 'auto',
	ignoreCreeps        : true,
	maxOps              : DEFAULT_MAXOPS,
	maxRooms            : 20,
	avoidSK             : true,
	allowPortals        : true,
	usePortalThreshold  : 10,
	portalsMustBeInRange: 6,
	ensurePath          : false,
});

/**
 * Selects the properties of PathOptions that are also on MatrixOptions.
 */
const _defaultMatrixOptionsKeys = _.keys(getDefaultMatrixOptions());

function getMatrixOptsFromPathOpts(opts: PathOptions): Partial<MatrixOptions> {
	const matrixOpts: Partial<MatrixOptions> = _.pick(opts, _defaultMatrixOptionsKeys);
	if (opts.obstacles) { // might need to sort this string if I start adding nondeterministic obstacles
		matrixOpts.obstacles = packPosList(opts.obstacles);
	}
	return matrixOpts;
}

function pathOptsToMatrixAndVolatileOpts(opts: PathOptions): [Partial<MatrixOptions>, VolatileMatrixOptions] {
	const matrixOpts = getMatrixOptsFromPathOpts(opts);
	const volatileMatrixOpts: VolatileMatrixOptions = {};
	if (opts.blockCreeps) volatileMatrixOpts.blockCreeps = opts.blockCreeps;
	return [matrixOpts, volatileMatrixOpts];
}

/**
 * Module for pathing-related operations.
 */
@profile
export class Pathing {

	// Room avoidance methods ==========================================================================================

	/**
	 * Check if the room should be avoiding when calculating routes
	 */
	static shouldAvoid(roomName: string) {
		return Memory.rooms[roomName] && Memory.rooms[roomName][RMEM.AVOID];
		// TODO - make more sophisticated, move to RoomIntel
	}

	/**
	 * Update memory on whether a room should be avoided based on controller owner
	 */
	static updateRoomStatus(room: Room) {
		if (!room) {
			return;
		}
		if (!room.my && room.towers.length > 0 && !isAlly(room.owner || '')) {
			room.memory[RMEM.AVOID] = true;
		} else {
			delete room.memory[RMEM.AVOID];
			// if (room.memory.expansionData == false) delete room.memory.expansionData;
		}
	}

	// Pathfinding and room callback methods ===========================================================================

	/**
	 * Find a path from origin to destination
	 */
	static findPath(origin: RoomPosition, destination: RoomPosition, opts: PathOptions = {}): PathingReturn {

		_.defaults(opts, getDefaultPathOptions());

		// check to see whether findRoute should be used
		const linearDistance = Game.map.getRoomLinearDistance(origin.roomName, destination.roomName);
		if (opts.maxRooms && linearDistance > opts.maxRooms && !opts.allowPortals) {
			log.warning(`Pathing from ${origin.print} to ${destination.print} exceeds max room specification ` +
						`of ${opts.maxRooms}!`);
		}

		let route: Route | undefined = opts.route;
		if (!route && (opts.useFindRoute == true || (opts.useFindRoute === undefined && linearDistance >= 3))) {
			const foundRoute = this.findRoute(origin.roomName, destination.roomName, opts);
			if (foundRoute != ERR_NO_PATH) {
				route = foundRoute;
			}
		}


		const destinationGoal: PathFinderGoal | PathFinderGoal[] = {pos: destination, range: opts.range!};
		const callback = (roomName: string) => Pathing.roomCallback(roomName, origin, destination, route, opts);
		let ret: PathFinderPath;

		// Did the route use portals?
		const portalExitStepIndex = _.findIndex(route || [], step => step.exit == FIND_EXIT_PORTAL);
		const usesPortals = (portalExitStepIndex != -1); // index is -1 if not found
		let portalUsed: PortalInfo | undefined;

		if (usesPortals) {
			// If we traversed a portal we need to call pathfinder twice and merge the two paths
			const portalEntranceStepIndex = portalExitStepIndex - 1;
			const portalEntraceRoom = portalEntranceStepIndex < 0
									  ? origin.roomName
									  : route![portalExitStepIndex - 1].room;

			const portals = RoomIntel.getPortalInfo(portalEntraceRoom);
			const portalGoals = _.map(portals, portal => ({pos: portal.pos, range: 0}));
			const path1ret = PathFinder.search(origin, portalGoals, {
				maxOps      : opts.maxOps,
				maxRooms    : opts.maxRooms,
				plainCost   : opts.terrainCosts!.plainCost,
				swampCost   : opts.terrainCosts!.swampCost,
				roomCallback: callback,
			});
			// if the path is incomplete then we'll let it get handled at the end of this method
			if (!path1ret.incomplete) {
				const lastPosInPath = _.last(path1ret.path);
				const usedPortal = _.find(portals, portal => portal.pos.isEqualTo(lastPosInPath));
				if (usedPortal) {
					portalUsed = usedPortal;
					const portalDest = usedPortal.destination;
					const path2ret = PathFinder.search(portalDest, destinationGoal, {
						maxOps      : opts.maxOps,
						maxRooms    : opts.maxRooms,
						plainCost   : opts.terrainCosts!.plainCost,
						swampCost   : opts.terrainCosts!.swampCost,
						roomCallback: callback,
					});
					ret = {
						path      : path1ret.path.concat([usedPortal.destination]).concat(path2ret.path),
						ops       : path1ret.ops + path2ret.ops,
						cost      : path1ret.ops + path2ret.ops,
						incomplete: path1ret.incomplete || path2ret.incomplete,
					};
				} else {
					log.error(`Pathing: No Portal pos in ${JSON.stringify(path1ret.path)}! (Why?)`);
					ret = path1ret;
				}
			} else {
				log.error(`Pathing: Incomplete first half of pathing from ${origin.print} to nearest portal!`);
				ret = path1ret;
			}
		} else {
			ret = PathFinder.search(origin, destinationGoal, {
				maxOps      : opts.maxOps,
				maxRooms    : opts.maxRooms,
				plainCost   : opts.terrainCosts!.plainCost,
				swampCost   : opts.terrainCosts!.swampCost,
				roomCallback: callback,
			});
		}

		if (ret.incomplete && opts.ensurePath && linearDistance <= 3 && !opts.route) {
			// handle case where pathfinder failed at a short distance due to not using findRoute
			// can happen for situations where the creep would have to take an uncommonly indirect path
			// options.allowedRooms and options.routeCallback can also be used to handle this situation
			const useRoute = this.findRoute(origin.roomName, destination.roomName, opts);
			if (useRoute != ERR_NO_PATH) {
				log.warning(`Pathing: findPath from ${origin.print} to ${destination.print} failed without ` +
							`specified route. Trying again with route: ${JSON.stringify(useRoute)}.`);
				opts.route = useRoute;
				ret = this.findPath(origin, destination, opts);
				if (ret.incomplete) {
					log.error(`Pathing: second attempt from ${origin.print} to ${destination.print} ` +
							  `was unsuccessful!`);
				}
			} else {
				log.error(`Pathing: findPath from ${origin.print} to ${destination.print} failed and route could ` +
						  `not be explicitly computed!`);
			}
		}
		return {
			path       : ret.path,
			incomplete : ret.incomplete,
			ops        : ret.ops,
			cost       : ret.cost,
			route      : route,
			usesPortals: usesPortals,
			portalUsed : portalUsed,
		};
	}

	/**
	 * Find a viable sequence of rooms to narrow down Pathfinder algorithm
	 */
	static findRoute(origin: string, destination: string, opts: PathOptions = {}): Route | ERR_NO_PATH {

		_.defaults(opts, getDefaultPathOptions());

		const linearDistance = Game.map.getRoomLinearDistance(origin, destination);
		const maxRooms = opts.maxRooms || linearDistance + 10;

		const myZoneStatus = RoomIntel.getMyZoneStatus();
		if (RoomIntel.getRoomStatus(destination).status != myZoneStatus) {
			return ERR_NO_PATH;
		}

		// This takes a portal room near the origin and spits out the best destination room of all portals in the room
		const getBestPortalDestination: (portalRoom: string) => string | undefined = (portalRoom) => {
			const portalInfo = RoomIntel.getPortalInfo(portalRoom);
			if (portalInfo.length == 0) {
				return;
			}
			const bestPortalDest = _(portalInfo)
				.map(portal => portal.destination.roomName)
				.unique()
				.min(portalDest => Game.map.getRoomLinearDistance(portalDest, destination)) as string;
			return bestPortalDest;
		};

		// Route finder callback for portal searching
		const callback = (roomName: string) => {
			const rangeToRoom = Game.map.getRoomLinearDistance(origin, roomName);
			if (rangeToRoom > maxRooms) { // room is too far out of the way
				return Infinity;
			}
			if (!opts.allowHostile && this.shouldAvoid(roomName) &&
				roomName !== destination && roomName !== origin) { // room is marked as "avoid" in room memory
				return Infinity;
			}
			if (RoomIntel.getRoomStatus(roomName).status != myZoneStatus) {
				return Infinity; // can't path outside of your local newbie/respawn zone
			}
			return 1;
			// TODO: include better pathing heuristics here such as average terrain value or avg pathing btw 2 points
		};

		let route: Route | ERR_NO_PATH = Game.map.findRoute(origin, destination, {routeCallback: callback});

		if (opts.allowPortals && (route == ERR_NO_PATH || route.length >= (opts.usePortalThreshold || 1))) {
			// Narrow down a list of portal rooms that could possibly lead to the destination
			const validPortalRooms = _.filter(RoomIntel.memory.portalRooms, roomName => {
				// Is the first leg of the trip too far?
				const originToPortal = Game.map.getRoomLinearDistance(origin, roomName);
				if (originToPortal > opts.maxRooms!) return false;
				if (opts.portalsMustBeInRange && originToPortal > opts.portalsMustBeInRange) return false;

				// Are there intra-shard portals here?
				const bestPortalDestination = getBestPortalDestination(roomName);
				if (!bestPortalDestination) return false;

				// Is the first + second leg of the trip too far?
				const portalToDestination = Game.map.getRoomLinearDistance(destination, bestPortalDestination);
				return originToPortal + portalToDestination <= opts.maxRooms!;
			});

			// Figure out which portal room is the best one to use
			const portalCallback = (roomName: string) => {
				if (!opts.allowHostile && this.shouldAvoid(roomName) &&
					roomName !== destination && roomName !== origin) { // room is marked as "avoid" in room memory
					return Infinity;
				}
				if (RoomIntel.getRoomStatus(roomName).status != myZoneStatus) {
					return Infinity; // can't path outside of your local newbie/respawn zone
				}
				return 1;
			};
			const bestPortalRoom = minBy(validPortalRooms, portalRoom => {
				const bestPortalDestination = getBestPortalDestination(portalRoom) as string; // room def has portal
				const originToPortalRoute = Game.map.findRoute(origin, portalRoom,
															   {routeCallback: portalCallback});
				const portalToDestinationRoute = Game.map.findRoute(bestPortalDestination, destination,
																	{routeCallback: portalCallback});
				if (originToPortalRoute != ERR_NO_PATH && portalToDestinationRoute != ERR_NO_PATH) {
					const portalRouteLength = originToPortalRoute.length + portalToDestinationRoute.length;
					const directRouteLength = route != ERR_NO_PATH ? route.length : Infinity;
					if (portalRouteLength < directRouteLength) {
						return portalRouteLength;
					} else {
						return false; // no sense using portals if it make the route even longer
					}
				} else {
					return false;
				}
			});

			if (bestPortalRoom) {
				const portalDest = getBestPortalDestination(bestPortalRoom) as string;
				const originToPortalRoute = Game.map.findRoute(origin, bestPortalRoom,
															   {routeCallback: portalCallback});
				const portalToDestinationRoute = Game.map.findRoute(portalDest, destination,
																	{routeCallback: portalCallback});
				// This will always be true but gotta check so TS doesn't complain...
				if (originToPortalRoute != ERR_NO_PATH && portalToDestinationRoute != ERR_NO_PATH) {
					route = [...originToPortalRoute,
							 {exit: FIND_EXIT_PORTAL, room: portalDest},
							 ...portalToDestinationRoute];

					// if (origin == 'E26S47') console.log('PORTAL ROUTE:', print(route));

				}

			}
		}

		if (route == ERR_NO_PATH) {
			log.warning(`Pathing: couldn't findRoute from ${origin} to ${destination} ` +
						`with opts ${JSON.stringify(opts)}!`);
			return ERR_NO_PATH;
		} else {
			return route;
		}
	}

	/**
	 * Find a path from origin to destination
	 */
	static findSwarmPath(origin: RoomPosition, destination: RoomPosition, width: number, height: number,
						 options: PathOptions = {}): PathFinderPath {
		_.defaults(options, {
			blockCreeps: false,
			maxOps     : 2 * DEFAULT_MAXOPS,
			range      : 1,
		});
		// Make copies of the destination offset for where anchor could be
		const destinations = this.getPosWindow(destination, -width, -height);
		const callback = (roomName: string) => this.swarmRoomCallback(roomName, width, height, options);
		return PathFinder.search(origin, _.map(destinations, pos => ({pos: pos, range: options.range!})), {
			maxOps      : options.maxOps,
			maxRooms    : options.maxRooms,
			plainCost   : 1,
			swampCost   : 5,
			roomCallback: callback,
		});
	}

	/**
	 * Get a window of offset RoomPositions from an anchor position and a window width and height
	 */
	static getPosWindow(anchor: RoomPosition, width: number, height: number): RoomPosition[] {
		const positions: RoomPosition[] = [];
		for (const dx of _.range(0, width, width < 0 ? -1 : 1)) {
			for (const dy of _.range(0, height, height < 0 ? -1 : 1)) {
				positions.push(anchor.getOffsetPos(dx, dy));
			}
		}
		return positions;
	}

	/**
	 * Returns the shortest path from start to end position, regardless of (passable) terrain
	 */
	static findShortestPath(startPos: RoomPosition, endPos: RoomPosition,
							opts: PathOptions = {}): PathFinderPath {
		const optDefaults: PathOptions = {
			blockCreeps : false,
			range       : 1,
			terrainCosts: {plainCost: 1, swampCost: 1}
		};
		_.defaults(opts, opts);
		const ret = this.findPath(startPos, endPos, opts);
		if (ret.incomplete) log.alert(`Pathing: incomplete path from ${startPos.print} to ${endPos.print}!`);
		return ret;
	}

	/**
	 * Returns the shortest path from start to end position, regardless of (passable) terrain
	 */
	static findPathToRoom(startPos: RoomPosition, roomName: string, options: PathOptions = {}): PathFinderPath {
		options.range = 23;
		const ret = this.findPath(startPos, new RoomPosition(25, 25, roomName), options);
		if (ret.incomplete) log.alert(`Pathing: incomplete path from ${startPos.print} to ${roomName}!`);
		return ret;
	}

	/**
	 * Default room callback, which automatically determines the most appropriate callback method to use
	 */
	static roomCallback(roomName: string, origin: RoomPosition, destination: RoomPosition,
						route: Route | undefined, opts: PathOptions): CostMatrix | boolean {
		if (roomName != origin.roomName && roomName != destination.roomName) {
			if (route && !_.any(route, routePart => routePart.room == roomName)) {
				return false; // only allowed to visit these rooms if route is specified
			}
			if (!opts.allowHostile && this.shouldAvoid(roomName)) {
				return false; // don't go through hostile rooms
			}
		}

		const [matrixOpts, volatileMatrixOpts] = pathOptsToMatrixAndVolatileOpts(opts);
		const matrix = MatrixLib.getMatrix(roomName, matrixOpts, volatileMatrixOpts);

		if (opts.modifyRoomCallback && Game.rooms[roomName]) {
			// Return a modified copy the matrix
			return opts.modifyRoomCallback(Game.rooms[roomName], matrix.clone());
		} else {
			// No modifications necessary; return the matrix
			return matrix;
		}

	}

	static swarmRoomCallback(roomName: string, width: number, height: number,
							 opts: SwarmMoveOptions): CostMatrix {
		const matrixOpts: Partial<MatrixOptions> = {
			explicitTerrainCosts: true,
			ignoreStructures    : opts.ignoreStructures,
			swarmWidth          : width,
			swarmHeight         : height,
		};
		const volatileMatrixOpts: VolatileMatrixOptions = {};
		if (opts.blockCreeps) volatileMatrixOpts.blockCreeps = opts.blockCreeps;

		const matrix = MatrixLib.getMatrix(roomName, matrixOpts, volatileMatrixOpts);

		if (opts.displayCostMatrix) {
			Visualizer.displayCostMatrix(matrix, roomName);
		}
		return matrix;
	}

	private static kitingRoomCallback(roomName: string): CostMatrix | boolean {
		const room = Game.rooms[roomName];
		if (room) {
			return Pathing.getKitingMatrix(room);
		} else { // have no vision
			return true;
		}
	}

	/**
	 * Get a kiting path within a room
	 */
	static findKitingPath(creepPos: RoomPosition, fleeFrom: (RoomPosition | HasPos)[],
						  opts: PathOptions = {}): PathFinderPath {
		_.defaults(opts, {
			fleeRange   : 5,
			terrainCosts: {plainCost: 1, swampCost: 5},
		});
		const fleeFromPos = _.map(fleeFrom, flee => normalizePos(flee));
		const avoidGoals = _.map(fleeFromPos, pos => {
			return {pos: pos, range: opts.fleeRange!};
		});
		return PathFinder.search(creepPos, avoidGoals,
								 {
									 plainCost   : opts.terrainCosts!.plainCost,
									 swampCost   : opts.terrainCosts!.swampCost,
									 flee        : true,
									 roomCallback: Pathing.kitingRoomCallback,
									 maxRooms    : 1
								 });
	}

	/**
	 * Get a flee path possibly leaving the room; generally called further in advance of kitingPath
	 */
	static findFleePath(creepPos: RoomPosition, fleeFrom: (RoomPosition | HasPos)[],
						opts: PathOptions = {}): PathFinderPath {
		_.defaults(opts, {
			terrainCosts: {plainCost: 1, swampCost: 5},
		});
		if (opts.fleeRange == undefined) opts.fleeRange = opts.terrainCosts!.plainCost > 1 ? 20 : 10;
		const fleeFromPos = _.map(fleeFrom, flee => normalizePos(flee));
		const avoidGoals = _.map(fleeFromPos, pos => {
			return {pos: pos, range: opts.fleeRange!};
		});
		const callback = (roomName: string) => {
			if (!opts.allowHostile && this.shouldAvoid(roomName) && roomName != creepPos.roomName) {
				return false;
			}

			const [matrixOpts, volatileMatrixOpts] = pathOptsToMatrixAndVolatileOpts(opts);
			const matrix = MatrixLib.getMatrix(roomName, matrixOpts, volatileMatrixOpts);
			// Modify cost matrix if needed
			if (opts.modifyRoomCallback && Game.rooms[roomName]) {
				return opts.modifyRoomCallback(Game.rooms[roomName], matrix.clone());
			} else {
				return matrix;
			}
		};
		return PathFinder.search(creepPos, avoidGoals,
								 {
									 plainCost   : opts.terrainCosts!.plainCost,
									 swampCost   : opts.terrainCosts!.swampCost,
									 flee        : true,
									 roomCallback: callback,
								 });
	}

	// Cost matrix retrieval functions =================================================================================

	// /**
	//  * Get a cloned copy of the cost matrix for a room with specified options
	//  */
	// static getCostMatrix(room: Room, options: PathOptions, clone = true): CostMatrix {
	// 	let matrix: CostMatrix;
	// 	if (options.avoidSK) {
	// 		matrix = this.getSkMatrix(room);
	// 	} else if (options.ignoreStructures) {
	// 		matrix = new PathFinder.CostMatrix();
	// 	} else {
	// 		matrix = this.getDefaultMatrix(room);
	// 	}
	// 	if (options.ignoreCreeps == false) {
	// 		matrix = this.getCreepMatrix(room, matrix);
	// 	}
	// 	// Register other obstacles
	// 	if (options.obstacles && options.obstacles.length > 0) {
	// 		matrix = matrix.clone();
	// 		for (const obstacle of options.obstacles) {
	// 			if (obstacle && obstacle.roomName == room.name) {
	// 				matrix.set(obstacle.x, obstacle.y, 0xff);
	// 			}
	// 		}
	// 	}
	// 	if (clone) {
	// 		matrix = matrix.clone();
	// 	}
	// 	return matrix;
	// }

	// static getSwarmDefaultMatrix(room: Room, width: number, height: number,
	// 							 options: SwarmMoveOptions = {}, clone = true): CostMatrix {
	// 	let matrix = $.costMatrix(room.name, `swarm${width}x${height}`, () => {
	// 		const mat = this.getTerrainMatrix(room.name).clone();
	// 		this.blockImpassibleStructures(mat, room);
	// 		this.setExitCosts(mat, room.name, options.exitCost || 10);
	// 		this.applyMovingMaximum(mat, width, height);
	// 		return mat;
	// 	}, 25);
	// 	if (options.ignoreCreeps == false) {
	// 		matrix = matrix.clone();
	// 		this.blockHostileCreeps(matrix, room); // todo: need to smear again?
	// 	}
	// 	if (clone) {
	// 		matrix = matrix.clone();
	// 	}
	// 	return matrix;
	// }

	// private static getCostMatrixForInvisibleRoom(roomName: string, options: PathOptions,
	// 											 clone = true): CostMatrix {
	// 	let matrix: CostMatrix | undefined;
	// 	if (options.avoidSK) {
	// 		matrix = $.costMatrixRecall(roomName, MatrixTypes.sk);
	// 	} else {
	// 		matrix = $.costMatrixRecall(roomName, MatrixTypes.default);
	// 	}
	// 	// Hm, we haven't found any previously cached matrices; let's see if we can get stuff from room intel
	// 	if (!matrix) {
	// 		const roomInfo = RoomIntel.getAllRoomObjectInfo(roomName);
	// 		if (roomInfo) {
	// 			// Cool let's set walkability based on what we remember
	// 			matrix = new PathFinder.CostMatrix();
	// 			const structureData = roomInfo.importantStructures;
	// 			if (structureData) {
	// 				const structures = _.compact([structureData.storagePos,
	// 											  structureData.terminalPos,
	// 											  ...structureData.towerPositions,
	// 											  ...structureData.spawnPositions,
	// 											  ...structureData.wallPositions,
	// 											  ...structureData.rampartPositions]) as RoomPosition[];
	// 				_.forEach(structures, pos => matrix!.set(pos.x, pos.y, 0xff));
	// 			}
	// 			const portals = roomInfo.portals;
	// 			_.forEach(portals, portal => matrix!.set(portal.pos.x, portal.pos.y, PORTAL_COST));
	// 			const skLairs = roomInfo.skLairs;
	//
	// 			if (skLairs.length > 0) {
	// 				// The source keepers usually hang out by the closest mineral or source but sometimes on lair
	// 				const avoidRange = 5;
	// 				const terrain = Game.map.getRoomTerrain(roomName);
	// 				const blockThese = _.compact([...roomInfo.sources,
	// 											  roomInfo.mineral,
	// 											  ...roomInfo.skLairs]) as HasPos[];
	// 				_.forEach(blockThese, thing => {
	// 					let x, y: number;
	// 					for (let dx = -avoidRange; dx <= avoidRange; dx++) {
	// 						for (let dy = -avoidRange; dy <= avoidRange; dy++) {
	// 							x = thing.pos.x + dx;
	// 							y = thing.pos.y + dy;
	// 							if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
	// 								const cost = SK_COST * (avoidRange + 1 - Math.max(Math.abs(dx), Math.abs(dy)));
	// 								matrix!.set(thing.pos.x + dx, thing.pos.y + dy, cost);
	// 							}
	// 						}
	// 					}
	// 				});
	// 			}
	// 		}
	// 	}
	// 	// Register other obstacles
	// 	if (matrix && options.obstacles && options.obstacles.length > 0) {
	// 		matrix = matrix.clone();
	// 		for (const obstacle of options.obstacles) {
	// 			if (obstacle && obstacle.roomName == roomName) {
	// 				matrix.set(obstacle.x, obstacle.y, 0xff);
	// 			}
	// 		}
	// 	}
	// 	if (matrix && clone) {
	// 		matrix = matrix.clone();
	// 	}
	// 	return matrix!;
	// }

	// Cost matrix generation functions ================================================================================

	// /**
	//  * Get a matrix of explicit terrain values for a room
	//  */
	// static getTerrainMatrix(roomName: string, costs: TerrainCosts = {plainCost: 1, swampCost: 5}): CostMatrix {
	// 	return $.costMatrix(roomName, `terrain:${costs.plainCost}:${costs.swampCost}`, () => {
	// 		const matrix = new PathFinder.CostMatrix();
	// 		const terrain = Game.map.getRoomTerrain(roomName);
	// 		for (let y = 0; y < 50; ++y) {
	// 			for (let x = 0; x < 50; ++x) {
	// 				switch (terrain.get(x, y)) {
	// 					case TERRAIN_MASK_SWAMP:
	// 						matrix.set(x, y, costs.swampCost);
	// 						break;
	// 					case TERRAIN_MASK_WALL:
	// 						matrix.set(x, y, 0xff);
	// 						break;
	// 					default: // plain
	// 						matrix.set(x, y, costs.plainCost);
	// 						break;
	// 				}
	// 			}
	// 		}
	// 		return matrix;
	// 	}, 10000);
	// }


	// /**
	//  * Default matrix for a room, setting impassable structures and constructionSites to impassible
	//  */
	// static getDefaultMatrix(room: Room): CostMatrix {
	// 	return $.costMatrix(room.name, MatrixTypes.default, () => {
	// 		const matrix = new PathFinder.CostMatrix();
	// 		// Set passability of structure positions
	// 		const impassibleStructures: Structure[] = [];
	// 		_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
	// 			if (s.structureType == STRUCTURE_ROAD) {
	// 				matrix.set(s.pos.x, s.pos.y, 1);
	// 			} else if (!s.isWalkable) {
	// 				impassibleStructures.push(s);
	// 			}
	// 		});
	// 		_.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
	// 		const portals = _.filter(impassibleStructures, s => s.structureType == STRUCTURE_PORTAL);
	// 		_.forEach(portals, p => matrix.set(p.pos.x, p.pos.y, PORTAL_COST));
	// 		// Set passability of construction sites
	// 		_.forEach(room.find(FIND_CONSTRUCTION_SITES), (site: ConstructionSite) => {
	// 			if (site.my && !site.isWalkable) {
	// 				matrix.set(site.pos.x, site.pos.y, 0xff);
	// 			}
	// 		});
	// 		return matrix;
	// 	});
	// }
	//
	//
	// /**
	//  * Default matrix for a room, setting impassable structures and constructionSites to impassible, ignoring roads
	//  */
	// static getDirectMatrix(room: Room): CostMatrix { // TODO: deprecated
	// 	return $.costMatrix(room.name, MatrixTypes.direct, () => {
	// 		const matrix = new PathFinder.CostMatrix();
	// 		// Set passability of structure positions
	// 		const impassibleStructures: Structure[] = [];
	// 		_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
	// 			if (!s.isWalkable) {
	// 				impassibleStructures.push(s);
	// 			}
	// 		});
	// 		_.forEach(impassibleStructures, s => matrix.set(s.pos.x, s.pos.y, 0xff));
	// 		const portals = _.filter(impassibleStructures, s => s.structureType == STRUCTURE_PORTAL);
	// 		_.forEach(portals, p => matrix.set(p.pos.x, p.pos.y, 0xfe));
	// 		// Set passability of construction sites
	// 		_.forEach(room.find(FIND_MY_CONSTRUCTION_SITES), (site: ConstructionSite) => {
	// 			if (!site.isWalkable) {
	// 				matrix.set(site.pos.x, site.pos.y, 0xff);
	// 			}
	// 		});
	// 		return matrix;
	// 	});
	// }
	//
	// /**
	//  * Avoids creeps in a room
	//  */
	// static getCreepMatrix(room: Room, fromMatrix?: CostMatrix): CostMatrix {
	// 	if (room._creepMatrix) {
	// 		return room._creepMatrix;
	// 	}
	// 	let matrix: CostMatrix;
	// 	if (fromMatrix) {
	// 		matrix = fromMatrix.clone();
	// 		_.forEach(room.find(FIND_CREEPS), c => matrix.set(c.pos.x, c.pos.y, CREEP_COST));
	// 		return matrix;
	// 	}
	// 	matrix = this.getDefaultMatrix(room).clone();
	// 	_.forEach(room.find(FIND_CREEPS), c => matrix.set(c.pos.x, c.pos.y, CREEP_COST)); // don't block off entirely
	// 	room._creepMatrix = matrix;
	// 	return room._creepMatrix;
	// }

	/**
	 * Kites around hostile creeps in a room
	 */
	static getKitingMatrix(room: Room): CostMatrix {
		if (room._kitingMatrix) {
			return room._kitingMatrix;
		}
		const matrix = MatrixLib.getMatrix(room.name, {}).clone();
		const avoidCreeps = room.dangerousHostiles;

		_.forEach(avoidCreeps, avoidCreep => MatrixLib.addSquarePotential(matrix, avoidCreep.pos, 3, 30));

		// // || c.getActiveBodyparts(HEAL) > 0);
		// const terrain = Game.map.getRoomTerrain(room.name);
		// _.forEach(avoidCreeps, avoidCreep => {
		// 	let cost: number;
		// 	for (let dx = -3; dx <= 3; dx++) {
		// 		for (let dy = -3; dy <= 3; dy++) {
		// 			const x = avoidCreep.pos.x + dx;
		// 			const y = avoidCreep.pos.y + dy;
		// 			if (terrain.get(x, y) != TERRAIN_MASK_WALL && matrix.get(x, y) != 1) { // if wall and no tunnel
		// 				cost = matrix.get(x, y);
		// 				cost += 40 - (10 * Math.max(Math.abs(dx), Math.abs(dy)));
		// 				matrix.set(avoidCreep.pos.x + dx, avoidCreep.pos.y + dy, cost);
		// 			}
		// 		}
		// 	}
		// });

		room._kitingMatrix = matrix;
		return room._kitingMatrix;
	}

	// /**
	//  * Avoids source keepers in a room
	//  */
	// private static getSkMatrix(room: Room): CostMatrix {
	// 	if (Cartographer.roomType(room.name) != ROOMTYPE_SOURCEKEEPER) {
	// 		return this.getDefaultMatrix(room);
	// 	}
	// 	return $.costMatrix(room.name, MatrixTypes.sk, () => {
	// 		const matrix = this.getDefaultMatrix(room).clone();
	// 		if (room.sourceKeepers.length > 0) {
	// 			// const blockThese = _.compact([...room.sources, room.mineral, ...room.keeperLairs]) as HasPos[];
	// 			// _.forEach(blockThese, thing => {
	// 			// 	for (let dx = -avoidRange; dx <= avoidRange; dx++) {
	// 			// 		for (let dy = -avoidRange; dy <= avoidRange; dy++) {
	// 			// 			const cost = SK_COST / 5 * (avoidRange + 1 - Math.max(Math.abs(dx), Math.abs(dy)));
	// 			// 			matrix!.set(thing.pos.x + dx, thing.pos.y + dy, cost);
	// 			// 		}
	// 			// 	}
	// 			// });
	// 			const terrain = Game.map.getRoomTerrain(room.name);
	// 			const avoidRange = 5;
	// 			_.forEach(room.sourceKeepers, sourceKeeper => {
	// 				let x, y: number;
	// 				for (let dx = -avoidRange; dx <= avoidRange; dx++) {
	// 					for (let dy = -avoidRange; dy <= avoidRange; dy++) {
	// 						x = sourceKeeper.pos.x + dx;
	// 						y = sourceKeeper.pos.y + dy;
	// 						if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
	// 							const cost = SK_COST * 2 * (avoidRange + 1 - Math.max(Math.abs(dx), Math.abs(dy)));
	// 							matrix.set(x, y, cost);
	// 						}
	// 					}
	// 				}
	// 			});
	// 		}
	// 		return matrix;
	// 	});
	// }

	// /**
	//  * Avoid locations in melee range of ramparts
	//  * @param room
	//  */
	// private static getNearRampartsMatrix(room: Room): CostMatrix {
	// 	return $.costMatrix(room.name, MatrixTypes.nearRampart, () => {
	// 		const matrix = this.getDefaultMatrix(room).clone();
	// 		const avoidRange = 1;
	// 		_.forEach(room.ramparts, rampart => {
	// 			for (let dx = -avoidRange; dx <= avoidRange; dx++) {
	// 				for (let dy = -avoidRange; dy <= avoidRange; dy++) {
	// 					matrix.set(rampart.pos.x + dx, rampart.pos.y + dy, 0xfe);
	// 				}
	// 			}
	// 		});
	// 		return matrix;
	// 	});
	// }

	// /* Avoids source keepers in a room */
	// private static getInvisibleSkMatrix(roomName: string): CostMatrix {
	// 	let matrix = new PathFinder.CostMatrix();
	// 	if (Cartographer.roomType(roomName) == ROOMTYPE_SOURCEKEEPER) {
	// 		if (Memory.rooms[roomName] && Memory.rooms[roomName].SKlairs != undefined) {
	//
	// 			const avoidRange = 5;
	// 			const lairs: RoomPosition[] = _.map(Memory.rooms[roomName].SKlairs!,
	// 												saved => derefCoords(saved.c, roomName));
	// 			_.forEach(lairs, lair => {
	// 				for (let dx = -avoidRange; dx <= avoidRange; dx++) {
	// 					for (let dy = -avoidRange; dy <= avoidRange; dy++) {
	// 						matrix.set(lair.x + dx, lair.y + dy, 0xff);
	// 					}
	// 				}
	// 			});
	// 		}
	// 	}
	// 	return matrix;
	// }

	// In-place CostMatrix manipulation routines =======================================================================

	/**
	 * Sets impassible structure positions to 0xff
	 */
	static blockImpassibleStructures(matrix: CostMatrix, room: Room) {
		_.forEach(room.find(FIND_STRUCTURES), (s: Structure) => {
			if (!s.isWalkable) {
				if (s.structureType == STRUCTURE_PORTAL) {
					matrix.set(s.pos.x, s.pos.y, 0xfe);
				} else {
					matrix.set(s.pos.x, s.pos.y, 0xff);
				}
			}
		});
	}

	// /**
	//  * Explicitly blocks off walls for a room
	//  */
	// static blockImpassibleTerrain(matrix: CostMatrix, roomName: string) {
	// 	const terrain = Game.map.getRoomTerrain(roomName);
	// 	for (let y = 0; y < 50; ++y) {
	// 		for (let x = 0; x < 50; ++x) {
	// 			if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
	// 				matrix.set(x, y, 0xff);
	// 			}
	// 		}
	// 	}
	// }

	// /**
	//  * Transform a CostMatrix such that the cost at each point is transformed to the max of costs in a width x height
	//  * window (indexed from upper left corner). This requires that terrain be explicitly specified in the matrix!
	//  */
	// static applyMovingMaxPool(matrix: CostMatrix, width: number, height: number) {
	// 	// Since we're moving in increasing order of x, y, we don't need to clone the matrix
	// 	let x, y, dx, dy: number;
	// 	let maxCost, cost: number;
	// 	for (x = 0; x <= 50 - width; x++) {
	// 		for (y = 0; y <= 50 - height; y++) {
	// 			maxCost = matrix.get(x, y);
	// 			for (dx = 0; dx <= width - 1; dx++) {
	// 				for (dy = 0; dy <= height - 1; dy++) {
	// 					cost = matrix.get(x + dx, y + dy);
	// 					if (cost > maxCost) {
	// 						maxCost = cost;
	// 					}
	// 				}
	// 			}
	// 			matrix.set(x, y, maxCost);
	// 		}
	// 	}
	// }

	// static setCostsInRange(matrix: CostMatrix, pos: RoomPosition | HasPos, range: number, cost = 30, add = false) {
	// 	pos = normalizePos(pos);
	// 	const terrain = Game.map.getRoomTerrain(pos.roomName);
	//
	// 	for (let dx = -range; dx <= range; dx++) {
	// 		const x = pos.x + dx;
	// 		if (x < 0 || x > 49) continue;
	// 		for (let dy = -range; dy <= range; dy++) {
	// 			const y = pos.y + dy;
	// 			if (y < 0 || y > 49) continue;
	// 			const posTerrain = terrain.get(x, y);
	// 			if (posTerrain === TERRAIN_MASK_WALL) {
	// 				continue;
	// 			}
	// 			let currentCost = matrix.get(x, y);
	// 			if (currentCost === 0) {
	// 				if (posTerrain === TERRAIN_MASK_SWAMP) {
	// 					currentCost += 10;
	// 				} else {
	// 					currentCost += 2;
	// 				}
	// 			}
	// 			if (currentCost >= 0xff || currentCost > cost) continue;
	// 			matrix.set(x, y, add ? Math.min(cost + currentCost, 200) : cost);
	// 		}
	// 	}
	// }

	// static blockExits(matrix: CostMatrix, rangeToEdge = 0) {
	// 	for (let x = rangeToEdge; x < 50 - rangeToEdge; x += 49 - rangeToEdge * 2) {
	// 		for (let y = rangeToEdge; y < 50 - rangeToEdge; y++) {
	// 			matrix.set(x, y, 0xff);
	// 		}
	// 	}
	// 	for (let x = rangeToEdge; x < 50 - rangeToEdge; x++) {
	// 		for (let y = rangeToEdge; y < 50 - rangeToEdge; y += 49 - rangeToEdge * 2) {
	// 			matrix.set(x, y, 0xff);
	// 		}
	// 	}
	// }
	//
	// static setExitCosts(matrix: CostMatrix, roomName: string, cost: number, rangeToEdge = 0) {
	// 	const terrain = Game.map.getRoomTerrain(roomName);
	//
	// 	for (let x = rangeToEdge; x < 50 - rangeToEdge; x += 49 - rangeToEdge * 2) {
	// 		for (let y = rangeToEdge; y < 50 - rangeToEdge; y++) {
	// 			if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
	// 				matrix.set(x, y, cost);
	// 			}
	// 		}
	// 	}
	// 	for (let x = rangeToEdge; x < 50 - rangeToEdge; x++) {
	// 		for (let y = rangeToEdge; y < 50 - rangeToEdge; y += 49 - rangeToEdge * 2) {
	// 			if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
	// 				matrix.set(x, y, cost);
	// 			}
	// 		}
	// 	}
	// }

	/**
	 * Serialize a path as a string of move directions
	 */
	static serializePath(startPos: RoomPosition, path: RoomPosition[], color = 'orange'): string {
		let serializedPath = '';
		let lastPosition = startPos;
		for (const position of path) {
			if (position.roomName == lastPosition.roomName) {
				new RoomVisual(position.roomName)
					.line(position, lastPosition, {color: color});
				serializedPath += lastPosition.getDirectionTo(position);
			}
			lastPosition = position;
		}
		return serializedPath;
	}

	static nextDirectionInPath(creep: AnyZerg): number | undefined {
		const moveData = creep.memory._go as MoveData;
		if (!moveData || !moveData.path || moveData.path.length == 0) {
			return;
		}
		return Number.parseInt(moveData.path[0], 10);
	}

	static nextPositionInPath(creep: AnyZerg): RoomPosition | undefined {
		const nextDir = this.nextDirectionInPath(creep);
		if (!nextDir) {
			return;
		}
		return this.positionAtDirection(creep.pos, nextDir);
	}

	static oppositeDirection(direction: DirectionConstant): DirectionConstant {
		switch (direction) {
			case TOP:
				return BOTTOM;
			case TOP_LEFT:
				return BOTTOM_RIGHT;
			case LEFT:
				return RIGHT;
			case BOTTOM_LEFT:
				return TOP_RIGHT;
			case BOTTOM:
				return TOP;
			case BOTTOM_RIGHT:
				return TOP_LEFT;
			case RIGHT:
				return LEFT;
			case TOP_RIGHT:
				return BOTTOM_LEFT;
		}
	}

	/**
	 * Returns a position at a direction from origin
	 */
	static positionAtDirection(origin: RoomPosition, direction: number): RoomPosition | undefined {
		const offsetX = [0, 0, 1, 1, 1, 0, -1, -1, -1];
		const offsetY = [0, -1, -1, 0, 1, 1, 1, 0, -1];
		const x = origin.x + offsetX[direction];
		const y = origin.y + offsetY[direction];
		if (x > 49 || x < 0 || y > 49 || y < 0) {
			return;
		}
		return new RoomPosition(x, y, origin.roomName);
	}

	// static savePath(path: RoomPosition[]): void {
	// 	const savedPath: CachedPath = {
	// 		path  : path,
	// 		length: path.length,
	// 		tick  : Game.time
	// 	};
	// 	const originName = _.first(path).name;
	// 	const destinationName = _.last(path).name;
	// 	if (!Memory.pathing.paths[originName]) {
	// 		Memory.pathing.paths[originName] = {};
	// 	}
	// 	Memory.pathing.paths[originName][destinationName] = savedPath;
	// }

	// Distance and path weight calculations ===========================================================================

	/**
	 * Calculate and/or cache the length of the shortest path between two points.
	 * Cache is probabilistically cleared in Mem
	 */
	static distance(pos1: RoomPosition, pos2: RoomPosition): number | undefined {
		const [name1, name2] = [packPos(pos1), packPos(pos2)].sort(); // path length is the same in either direction
		if (!Memory.pathing.distances[name1]) {
			Memory.pathing.distances[name1] = {};
		}
		if (!Memory.pathing.distances[name1][name2]) {
			const ret = this.findPath(pos1, pos2);
			if (!ret.incomplete) {
				Memory.pathing.distances[name1][name2] = ret.path.length;
			} else {
				log.error(`PATHING: could not compute distance from ${pos1.print} to ${pos2.print}!`);
			}
		}
		return Memory.pathing.distances[name1][name2];
	}

	// static calculatePathWeight(startPos: RoomPosition, endPos: RoomPosition, options: MoveOptions = {}): number {
	// 	_.defaults(options, {
	// 		range: 1,
	// 	});
	// 	const ret = this.findPath(startPos, endPos, options);
	// 	let weight = 0;
	// 	for (const pos of ret.path) {
	// 		if (!pos.room) { // If you don't have vision, assume there are roads
	// 			weight += 1;
	// 		} else {
	// 			if (pos.lookForStructure(STRUCTURE_ROAD)) {
	// 				weight += 1;
	// 			} else {
	// 				const terrain = pos.lookFor(LOOK_TERRAIN)[0];
	// 				if (terrain == 'plain') {
	// 					weight += 2;
	// 				} else if (terrain == 'swamp') {
	// 					weight += 10;
	// 				}
	// 			}
	// 		}
	// 	}
	// 	return weight;
	// }

	// /**
	//  * Calculates and/or caches the weighted distance for the most efficient path. Weight is sum of tile weights:
	//  * Road = 1, Plain = 2, Swamp = 10. Cached weights are cleared in Mem occasionally.
	//  */
	// static weightedDistance(arg1: RoomPosition, arg2: RoomPosition): number {
	// 	const [pos1, pos2] = _.sortBy([arg1, arg2], pos => packPos(pos)); // alphabetize since path lengths are the same
	// 	if (!Memory.pathing.weightedDistances[pos1.name]) {
	// 		Memory.pathing.weightedDistances[pos1.name] = {};
	// 	}
	// 	if (!Memory.pathing.weightedDistances[pos1.name][pos2.name]) {
	// 		Memory.pathing.weightedDistances[pos1.name][pos2.name] = this.calculatePathWeight(pos1, pos2);
	// 	}
	// 	return Memory.pathing.weightedDistances[pos1.name][pos2.name];
	// }

	/**
	 * Whether another object in the same room can be reached from the current position.
	 * This method is very expensive and kind of stupid, so use it sparingly!
	 */
	static isReachable(startPos: RoomPosition, endPos: RoomPosition, obstacles: (RoomPosition | HasPos)[],
					   options: PathOptions = {}): boolean {
		_.defaults(options, {
			blockCreeps: false,
			range      : 1,
			maxOps     : 2000,
			ensurePath : false,
		});
		if (startPos.roomName != endPos.roomName) {
			log.error(`isReachable() should only be used within a single room!`);
			return false;
		}
		const matrix = new PathFinder.CostMatrix();
		_.forEach(obstacles, obstacle => {
			if (hasPos(obstacle)) {
				matrix.set(obstacle.pos.x, obstacle.pos.y, 0xfe);
			} else {
				matrix.set(obstacle.x, obstacle.y, 0xfe);
			}
		});
		const callback = (roomName: string) => roomName == endPos.roomName ? matrix : false;
		const ret = PathFinder.search(startPos, {pos: endPos, range: options.range!}, {
			maxOps      : options.maxOps,
			plainCost   : 1,
			swampCost   : 5,
			maxRooms    : 1,
			roomCallback: callback,
		});
		if (ret.incomplete) {
			return false;
		} else {
			for (const pos of ret.path) {
				if (matrix.get(pos.x, pos.y) > 100) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Like isReachable(), but returns the first position which should be cleared to find a path to destination
	 */
	static findBlockingPos(startPos: RoomPosition, endPos: RoomPosition, obstacles: (RoomPosition | HasPos)[],
						   options: PathOptions = {}): RoomPosition | undefined {
		_.defaults(options, {
			blockCreeps: false,
			range      : 1,
			maxOps     : 2000,
			ensurePath : false,
		});
		if (startPos.roomName != endPos.roomName) {
			log.error(`findBlockingPos() should only be used within a single room!`);
			return undefined;
		}
		const matrix = new PathFinder.CostMatrix();
		_.forEach(obstacles, obstacle => {
			if (hasPos(obstacle)) {
				matrix.set(obstacle.pos.x, obstacle.pos.y, 0xfe);
			} else {
				matrix.set(obstacle.x, obstacle.y, 0xfe);
			}
		});
		const callback = (roomName: string) => roomName == endPos.roomName ? matrix : false;
		const ret = PathFinder.search(startPos, {pos: endPos, range: options.range!}, {
			maxOps      : options.maxOps,
			plainCost   : 1,
			swampCost   : 5,
			maxRooms    : 1,
			roomCallback: callback,
		});
		for (const pos of ret.path) {
			if (matrix.get(pos.x, pos.y) > 100) {
				return pos;
			}
		}
	}

	/**
	 * Find the first walkable position in the room, spiraling outward from the center
	 */
	static findPathablePosition(roomName: string,
								clearance: { width: number, height: number } = {width: 1, height: 1}): RoomPosition {
		const terrain = Game.map.getRoomTerrain(roomName);

		let x, y: number;
		let allClear: boolean;
		for (let radius = 0; radius < 23; radius++) {
			for (let dx = -radius; dx <= radius; dx++) {
				for (let dy = -radius; dy <= radius; dy++) {
					if (Math.abs(dy) !== radius && Math.abs(dx) !== radius) {
						continue;
					}
					x = 25 + dx;
					y = 25 + dy;
					allClear = true;
					for (let w = 0; w < clearance.width; w++) {
						for (let h = 0; h < clearance.height; h++) {
							if (terrain.get(x + w, y + h) === TERRAIN_MASK_WALL) {
								allClear = false;
							}
						}
					}
					if (allClear) {
						return new RoomPosition(x, y, roomName);
					}
				}
			}
		}
		// Should never reach here!
		return new RoomPosition(-10, -10, 'cannotFindPathablePosition');
	}

}

// Register global instance
global.Pathing = Pathing;
