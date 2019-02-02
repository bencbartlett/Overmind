// High-level planning for skirmishing and combats

import {CombatIntel, CombatPotentials} from '../intel/CombatIntel';
import {CombatZerg} from '../zerg/CombatZerg';
import {exponentialMovingAverage, getCacheExpiration} from '../utilities/utils';
import {DefenseDirective} from '../directives/defense/_DefenseDirective';
import {CombatOverlord} from '../overlords/CombatOverlord';

export interface Threat {
	directive: DefenseDirective;
	potentials: CombatPotentials | undefined;
	roomName: string;
	closestColony: string;
	distances: {}
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
	}
	attackEffectiveness: {
		drain: number;

	}

}

const THREAT_EXPIRATION = 100;
const THREAT_DECAY_TIMESCALE = 100;
const SIEGE_ANALYSIS_EXPIRATION = 2500;

export interface SiegeAnalysis {
	owner: string | undefined;
	maxTowerDamage: number;
	minBarrierHits: number;
	avgBarrierHits: number;
	expiration: number;
}


interface CombatPlannerMemory {

	threats: {
		[directiveRef: string]: Threat
	}

	profiles: { [playerName: string]: EnemyProfile }

	defenses: {
		[roomName: string]: {}
	}

	sieges: {
		[roomName: string]: {
			analysis?: SiegeAnalysis,
		}
	}

	skirmishes: {
		[roomName: string]: {}
	}
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
		let idleCreeps: CombatZerg[] = [];


		for (let creep of this.creeps) {
			if (!creep.overlord) {
				idleCreeps.push(creep);
			} else {
				let creepDirective = (<CombatOverlord>creep.overlord).directive;
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
				let lastPotentials = this.memory.threats[directive.ref].potentials;
				if (lastPotentials) {
					attack = lastPotentials.attack;
					rangedAttack = lastPotentials.rangedAttack;
					heal = lastPotentials.heal;
				} else {
					attack = 0;
					rangedAttack = 0;
					heal = 0;
				}

				let decayedAttack = exponentialMovingAverage(threat.potentials.attack, attack, THREAT_DECAY_TIMESCALE);
				let decayedRangedAttack = exponentialMovingAverage(threat.potentials.rangedAttack,
																   rangedAttack, THREAT_DECAY_TIMESCALE);
				let decayedHeal = exponentialMovingAverage(threat.potentials.heal, heal, THREAT_DECAY_TIMESCALE);

				// TODO: adjust decay for creeps known to have moved to next visible room

				// Set new potential to maximum of current or decayed potential
				let potentials: CombatPotentials = {
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

	static getSiegeAnalysis(room: Room): SiegeAnalysis {

		let owner = room.owner;
		let towerDamageSamplePositions = _.map(_.range(20),
											   i => new RoomPosition(_.random(1, 48), _.random(1, 48), room.name));
		let maxTowerDamage = _.max(_.map(towerDamageSamplePositions,
										 pos => CombatIntel.towerDamageAtPos(pos, true)));
		let minBarrierHits = room.barriers.length > 0 ? _.min(_.map(room.barriers, b => b.hits)) : 0;
		let avgBarrierHits = room.barriers.length > 0 ? _.sum(room.barriers, b => b.hits) / room.barriers.length : 0;
		let expiration = getCacheExpiration(SIEGE_ANALYSIS_EXPIRATION);
		return {owner, maxTowerDamage, minBarrierHits, avgBarrierHits, expiration};

	}

	private registerSiegeAnalysis(room: Room): void {
		if (!this.memory.sieges[name]) {
			this.memory.sieges[name] = {};
		}
		if (!this.memory.sieges[name].analysis || Game.time > this.memory.sieges[name].analysis!.expiration) {
			this.memory.sieges[name].analysis = CombatPlanner.getSiegeAnalysis(room);
		}
	}

	init() {

		// Register new interactions in visible rooms
		for (let roomName in Game.rooms) {

			const room: Room = Game.rooms[roomName];

			// Make new siege analyses for rooms needing it
			if (room.owner && !room.my) {
				this.registerSiegeAnalysis(room);
			}

		}

		for (let directive of this.directives) {
			this.registerThreat(directive);
		}


	}

	run() {

	}

	visuals() {

	}

}
