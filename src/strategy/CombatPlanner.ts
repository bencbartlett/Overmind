// High-level planning for skirmishing and combats

import {log} from '../console/log';
import {DefenseDirective} from '../directives/defense/_DefenseDirective';
import {CombatIntel, CombatPotentials} from '../intel/CombatIntel';
import {Pathing} from '../movement/Pathing';
import {CombatOverlord} from '../overlords/CombatOverlord';
import {exponentialMovingAverage, getCacheExpiration} from '../utilities/utils';
import {CombatZerg} from '../zerg/CombatZerg';

export interface Threat {
	directive: DefenseDirective;
	potentials: CombatPotentials | undefined;
	roomName: string;
	closestColony: string;
	distances: {};
	lastSeen: {
		tick: number,
	};
}

export interface EnemyProfile {

	score: number;
	creepEffectiveness: {
		hydralisk: number;
		broodling: number;
		healer: number;
	};
	attackEffectiveness: {
		drain: number;

	};

}

const THREAT_EXPIRATION = 100;
const THREAT_DECAY_TIMESCALE = 100;
const SIEGE_ANALYSIS_EXPIRATION = 2500;

type RoomLayout = 'bunker' | 'edgewall' | 'innerwall' | 'exposed';

export interface SiegeAnalysis {
	owner: string | undefined;
	level: number;
	maxTowerDamage: number;
	minBarrierHits: number;
	avgBarrierHits: number;
	numWalls: number;
	numRamparts: number;
	roomLayout: RoomLayout;
	expiration: number;
}

interface CombatPlannerMemory {

	threats: {
		[directiveRef: string]: Threat
	};

	profiles: { [playerName: string]: EnemyProfile };

	defenses: {
		[roomName: string]: {}
	};

	sieges: {
		[roomName: string]: {
			analysis?: SiegeAnalysis,
		}
	};

	skirmishes: {
		[roomName: string]: {}
	};
}

const defaultCombatPlannerMemory: CombatPlannerMemory = {
	threats   : {},
	profiles  : {},
	defenses  : {},
	sieges    : {},
	skirmishes: {},
};

export class CombatPlanner {

	directives: DefenseDirective[];
	creeps: CombatZerg[];

	constructor() {
		_.defaults(this.memory, defaultCombatPlannerMemory);
	}

	get memory(): CombatPlannerMemory {
		return Memory.combatPlanner;
	}

	private static computeHitsToSpawn(room: Room): number {
		// TODO
		return 0;
	}


	// private getNeededPotentials(): CombatPotentials {
	// 	// TODO
	// }

	private spawnNeededCreeps() {

	}

	private assembleSquads(): void {

		// Figure out the best thing for each creep to be doing
		const idleCreeps: CombatZerg[] = [];


		for (const creep of this.creeps) {
			if (!creep.overlord) {
				idleCreeps.push(creep);
			} else {
				const creepDirective = (<CombatOverlord>creep.overlord).directive;
				if (creepDirective && creepDirective instanceof DefenseDirective) {
					if (this.memory.threats[creepDirective.ref]) {

					}
				}
			}
		}

	}

	static getThreat(directive: DefenseDirective): Threat {

		if (directive.room) {
			return {
				directive    : directive,
				potentials   : CombatIntel.getCombatPotentials(directive.room.hostiles),
				roomName     : directive.room.name,
				closestColony: directive.colony.name,
				distances    : directive.overlord.spawnGroup.memory.distances,
				lastSeen     : {
					tick: Game.time,
				}
			};
		} else {
			return {
				directive    : directive,
				potentials   : undefined,
				roomName     : directive.pos.roomName,
				closestColony: directive.colony.name,
				distances    : directive.overlord.spawnGroup.memory.distances,
				lastSeen     : {
					tick: Game.time,
				}
			};
		}

	}

	registerThreat(directive: DefenseDirective): void {

		const threat = CombatPlanner.getThreat(directive);

		if (this.memory.threats[directive.ref]) {

			// If a threat already exists, update it or allow potentials to decay

			if (threat.potentials) {  // you have vision

				// If you have new info on threat potentials, update the log in memory
				let attack, rangedAttack, heal: number;
				const lastPotentials = this.memory.threats[directive.ref].potentials;
				if (lastPotentials) {
					attack = lastPotentials.attack;
					rangedAttack = lastPotentials.rangedAttack;
					heal = lastPotentials.heal;
				} else {
					attack = 0;
					rangedAttack = 0;
					heal = 0;
				}

				const decayedAttack = exponentialMovingAverage(threat.potentials.attack, attack, THREAT_DECAY_TIMESCALE);
				const decayedRangedAttack = exponentialMovingAverage(threat.potentials.rangedAttack,
																   rangedAttack, THREAT_DECAY_TIMESCALE);
				const decayedHeal = exponentialMovingAverage(threat.potentials.heal, heal, THREAT_DECAY_TIMESCALE);

				// TODO: adjust decay for creeps known to have moved to next visible room

				// Set new potential to maximum of current or decayed potential
				const potentials: CombatPotentials = {
					attack      : Math.max(threat.potentials.attack, decayedAttack),
					rangedAttack: Math.max(threat.potentials.rangedAttack, decayedRangedAttack),
					heal        : Math.max(threat.potentials.heal, decayedHeal),
				};

				// Update the existing threat
				this.memory.threats[directive.ref].potentials = potentials;
				this.memory.threats[directive.ref].lastSeen.tick = Game.time;

			} else { // no vision


			}

		} else {

			// Register a new threat
			this.memory.threats[directive.ref] = threat;

		}

	}

	static getRoomLayout(room: Room): RoomLayout {
		let isBunker, isExposed, isInnerWall, isEdgeWall = false;
		const exitPositions = Pathing.getExitPositions(room.name);
		const terrain = Game.map.getRoomTerrain(room.name);

		// Room is bunker if >80% of hostile structures are covered by ramparts
		const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
		const hostileStructuresInRampart = _.filter(hostileStructures, s => s.pos.lookForStructure(STRUCTURE_RAMPART));
		isBunker = (hostileStructuresInRampart.length / hostileStructures.length >= 0.8);

		// Room is edgewall if every exit tile has wall or barrier at 2 range to left/right/top/bottom
		const walledOffExitTiles = _.filter(exitPositions, pos => {

			let lookPos: RoomPosition;
			const x = pos.x;
			const y = pos.y;

			if (x == 0) {
				lookPos = new RoomPosition(x + 2, y, room.name);
			} else if (x == 49) {
				lookPos = new RoomPosition(x - 2, y, room.name);
			} else if (y == 0) {
				lookPos = new RoomPosition(x, y + 2, room.name);
			} else if (y == 49) {
				lookPos = new RoomPosition(x, y - 2, room.name);
			} else { // shouldn't ever get here
				lookPos = pos;
			}

			if (terrain.get(lookPos.x, lookPos.y) == TERRAIN_MASK_WALL) {
				return true;
			} else {
				const rampart = lookPos.lookForStructure(STRUCTURE_RAMPART);
				const wall = lookPos.lookForStructure(STRUCTURE_WALL);
				return rampart != undefined || wall != undefined;
			}

		});
		if (walledOffExitTiles.length == walledOffExitTiles.length) {
			isEdgeWall = true;
		}

		// Room is inner wall if not bunker or edgewall and there is no path to spawn, otherwise exposed
		if (!isBunker && !isEdgeWall) {
			const entryPoints = _.compact(
				[_.find(exitPositions, pos => pos.x == 0),  // left
				 _.find(exitPositions, pos => pos.x == 49), // right
				 _.find(exitPositions, pos => pos.y == 0),  // top
				 _.find(exitPositions, pos => pos.y == 49), // bottom
				]) as RoomPosition[];
			const target = (room.spawns[0] || room.towers[0]);
			if (target) {
				const obstacles = _.filter(room.structures, s => !s.isWalkable);
				const isReachable = _.find(entryPoints, pos => Pathing.isReachable(pos, target.pos, obstacles));
				if (isReachable) {
					isExposed = true;
				}
			}
			if (!isExposed) {
				isInnerWall = true;
			}
		}

		if (isEdgeWall) {
			return 'edgewall';
		} else if (isBunker) {
			return 'bunker';
		} else if (isExposed) {
			return 'exposed';
		} else if (isInnerWall) {
			return 'innerwall';
		} else {
			log.warning(`Inconclusive room layout for ${room.print}! Assuming inner wall.`);
			return 'innerwall';
		}

	}

	static getSiegeAnalysis(room: Room): SiegeAnalysis {

		const owner = room.owner;
		const level = room.controller ? room.controller.level : 0;
		const towerDamageSamplePositions = _.map(_.range(20),
											   i => new RoomPosition(_.random(1, 48), _.random(1, 48), room.name));
		const maxTowerDamage = _.max(_.map(towerDamageSamplePositions,
										 pos => CombatIntel.towerDamageAtPos(pos, true)));
		const minBarrierHits = room.barriers.length > 0 ? _.min(_.map(room.barriers, b => b.hits)) : 0;
		const avgBarrierHits = room.barriers.length > 0 ? _.sum(room.barriers, b => b.hits) / room.barriers.length : 0;

		const numWalls = room.walls.length;
		const numRamparts = room.ramparts.length;

		const expiration = getCacheExpiration(SIEGE_ANALYSIS_EXPIRATION);

		const roomLayout = this.getRoomLayout(room);

		return {
			owner,
			level,
			maxTowerDamage,
			minBarrierHits,
			avgBarrierHits,
			numWalls,
			numRamparts,
			roomLayout,
			expiration
		};

	}

	private registerSiegeAnalysis(room: Room): void {
		if (!this.memory.sieges[room.name]) {
			this.memory.sieges[room.name] = {};
		}
		if (!this.memory.sieges[room.name].analysis || Game.time > this.memory.sieges[room.name].analysis!.expiration) {
			this.memory.sieges[room.name].analysis = CombatPlanner.getSiegeAnalysis(room);
		}
	}

	init() {

		// Register new interactions in visible rooms
		for (const roomName in Game.rooms) {

			const room: Room = Game.rooms[roomName];

			// Make new siege analyses for rooms needing it
			if (room.owner && !room.my) {
				this.registerSiegeAnalysis(room);
			}

		}

		for (const directive of this.directives) {
			this.registerThreat(directive);
		}


	}

	run() {

	}

	visuals() {

	}

}
