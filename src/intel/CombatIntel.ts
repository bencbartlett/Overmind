// Combat Intel - provides information related to making combat-related decisions

import {Directive} from '../directives/Directive';
import {Mem} from '../memory/Memory';
import {Colony} from '../Colony';
import {boostResources} from '../resources/map_resources';
import {Pathing} from '../movement/Pathing';
import {Cartographer} from '../utilities/Cartographer';
import {log} from '../console/log';
import {toCreep, Zerg} from '../zerg/Zerg';
import {isOwnedStructure, isStructure, isZerg} from '../declarations/typeGuards';
import {RoomIntel} from './RoomIntel';
import {profile} from '../profiler/decorator';

interface CombatIntelMemory {
	cache: {
		tick: number,

	}
}

@profile
export class CombatIntel {

	directive: Directive;

	constructor(directive: Directive) {
		this.directive = directive;
	}

	get memory(): CombatIntelMemory {
		return Mem.wrap(this.directive.memory, 'combatIntel', {});
	}

	get room(): Room | undefined {
		return this.directive.room;
	}

	get colony(): Colony {
		return this.directive.colony;
	}

	// Tower damage ====================================================================================================

	/* Get the tower damage at a given range */
	static singleTowerDamage(range: number): number {
		if (range <= TOWER_OPTIMAL_RANGE) {
			return TOWER_POWER_ATTACK;
		}
		range = Math.min(range, TOWER_FALLOFF_RANGE);
		let falloff = (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
		return TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF * falloff);
	}

	/* Total tower tamage from all towers in room at a given position */
	static towerDamageAtPos(pos: RoomPosition, ignoreEnergy = false): number | undefined {
		if (pos.room) {
			let expectedDamage = 0;
			for (let tower of pos.room.towers) {
				if (tower.energy > 0 || ignoreEnergy) {
					expectedDamage += this.singleTowerDamage(pos.getRangeTo(tower));
				}
			}
			return expectedDamage;
		}
	}

	// Cost matrix calculations

	private computeCostMatrix(): CostMatrix | undefined {
		if (this.room) {
			let matrix = new PathFinder.CostMatrix();
			let barriers = this.room.barriers;
			if (barriers.length > 0) {
				let highestHits = _.last(_.sortBy(barriers, barrier => barrier.hits)).hits;
				for (let barrier of barriers) {
					matrix.set(barrier.pos.x, barrier.pos.y, Math.ceil(barrier.hits * 10 / highestHits) * 10);
				}
			}
			return matrix;
		}
	}


	// Fallback and exit calculations ==================================================================================

	private findBestExit(matrix: CostMatrix, towers: StructureTower[],
						 spawns: StructureSpawn[]): RoomPosition | undefined {
		if (!this.room) {
			return;
		}
		let bestExit: RoomPosition | undefined;
		let destination = this.room.spawns[0] || this.room.storage; // enemy structure you are trying to get to
		if (!destination) {
			return;
		}
		let ret = Pathing.findPath(this.colony.pos, destination.pos, {range: 1});
		if (!ret.incomplete) {
			bestExit = _.find(ret.path, p => p.roomName == this.room!.name);
		}

		// Figure out possible exits to go from enemy room back to colony in a reasonable amount of time
		let maxRoomDistance = 8;
		let allowedExits: { [direction: string]: boolean } = {};
		if (!bestExit) {
			let exitData = Game.map.describeExits(this.room.name);
			for (let direction in exitData) {
				let roomName = exitData[<'1' | '3' | '5' | '7'>direction] as string;
				let allowedRooms = Pathing.findRoute(this.colony.name, roomName);
				if (allowedRooms && Object.keys(allowedRooms).length <= maxRoomDistance) {
					allowedExits[direction] = true;
				}
			}
			if (_.keys(allowedExits).length == 0) {
				return;
			}
		}

		// TODO
		let exitPositions: RoomPosition[] = [];
		for (let x = 0; x < 50; x += 49) {
			for (let y = 0; y < 50; y++) {
				if (x !== 0 && y !== 0 && x !== 49 && y !== 49) {
					continue;
				}
				if (Game.map.getTerrainAt(x, y, this.room.name) === 'wall') {
					continue;
				}
				matrix.set(x, y, 0xff);
				if (bestExit) {
					continue;
				}
				if (allowedExits['1'] && y === 0) {
					exitPositions.push(new RoomPosition(x, y, this.room.name));
				} else if (allowedExits['3'] && x === 49) {
					exitPositions.push(new RoomPosition(x, y, this.room.name));
				} else if (allowedExits['5'] && y === 49) {
					exitPositions.push(new RoomPosition(x, y, this.room.name));
				} else if (allowedExits['7'] && x === 0) {
					exitPositions.push(new RoomPosition(x, y, this.room.name));
				}
			}
		}

		if (!bestExit) {
			bestExit = _(exitPositions)
				.sortBy((p: RoomPosition) => -_.sum(towers, (t: Structure) => p.getRangeTo(t)))
				.head();
		}
		matrix.set(bestExit.x, bestExit.y, 1);

		return bestExit;
	}

	// static findBestSiegeExit(roomName: string, matrix?: CostMatrix): RoomPosition | undefined  {
	// 	let edgeCoords: [number, number][] = [];
	// 	for (let x = 0; x < 50; x += 49) {
	// 		for (let y = 0; y < 50; y++) {
	// 			edgeCoords.push([x,y])
	// 		}
	// 	}
	// 	for (let x = 0; x < 50; x++) {
	// 		for (let y = 0; y < 50; y += 49) {
	// 			edgeCoords.push([x,y])
	// 		}
	// 	}
	//
	// 	const room = Game.rooms[roomName];
	// 	let siegeTarget = CombatTargeting.findBestStructureTarget()
	// }

	findSimpleSiegeFallback(): RoomPosition {
		let ret = Pathing.findPath(this.colony.pos, this.directive.pos, {range: 23});
		let firstPosInRoom = _.find(ret.path, pos => pos.roomName == this.directive.pos.roomName);
		if (firstPosInRoom) {
			return CombatIntel.getFallbackFrom(firstPosInRoom);
		} else {
			return CombatIntel.getFallbackFrom(this.directive.pos);
		}
	}

	/* Fallback is a location on the other side of the nearest exit the directive is placed at */
	static getFallbackFrom(pos: RoomPosition, fallbackDistance = 2): RoomPosition {
		let {x, y, roomName} = pos;
		let rangesToExit = [[x, 'left'], [49 - x, 'right'], [y, 'top'], [49 - y, 'bottom']];
		let [range, direction] = _.first(_.sortBy(rangesToExit, pair => pair[0]));
		switch (direction) {
			case 'left':
				x = 49 - fallbackDistance;
				roomName = Cartographer.findRelativeRoomName(roomName, -1, 0);
				break;
			case 'right':
				x = fallbackDistance;
				roomName = Cartographer.findRelativeRoomName(roomName, 1, 0);
				break;
			case 'top':
				y = 49 - fallbackDistance;
				roomName = Cartographer.findRelativeRoomName(roomName, 0, -1);
				break;
			case 'bottom':
				y = fallbackDistance;
				roomName = Cartographer.findRelativeRoomName(roomName, 0, 1);
				break;
			default:
				log.error('Error getting fallback position!');
				break;
		}
		return new RoomPosition(x, y, roomName);
	}


	// Creep potentials ================================================================================================

	// Cache the result of a computation for a tick
	static cache(creep: Creep, key: string, callback: () => number): number {
		if (!creep.intel) creep.intel = {};
		if (creep.intel[key] == undefined) {
			creep.intel[key] = callback();
		}
		return creep.intel[key];
	}

	// Heal potential of a single creep in units of effective number of parts
	static getHealPotential(creep: Creep): number {
		return this.cache(creep, 'healPotential', () =>
			_.sum(creep.body, function (part) {
				let potential = 0;
				if (part.type == HEAL) {
					if (!part.boost) {
						potential = 1;
					} else if (part.boost == boostResources.heal[1]) {
						potential = BOOSTS.heal.LO.heal;
					} else if (part.boost == boostResources.heal[2]) {
						potential = BOOSTS.heal.LHO2.heal;
					} else if (part.boost == boostResources.heal[3]) {
						potential = BOOSTS.heal.XLHO2.heal;
					}
				}
				return potential * part.hits / 100;
			})
		);
	}

	static getHealAmount(creep: Creep | Zerg): number {
		return HEAL_POWER * this.getHealPotential(toCreep(creep));
	}

	static getRangedHealAmount(creep: Creep | Zerg): number {
		return RANGED_HEAL_POWER * this.getHealPotential(toCreep(creep));
	}

	// If a creep appears to primarily be a healer
	static isHealer(zerg: Creep | Zerg): boolean {
		const creep = toCreep(zerg);
		const healParts = _.filter(zerg.body, part => part.type == HEAL).length;
		const attackParts = _.filter(zerg.body, part => part.type == ATTACK).length;
		const rangedAttackParts = _.filter(zerg.body, part => part.type == RANGED_ATTACK).length;
		return healParts > attackParts + rangedAttackParts;
	}

	// Attack potential of a single creep in units of effective number of parts
	static getAttackPotential(creep: Creep): number {
		return this.cache(creep, 'attackPotential', () => _.sum(creep.body, function (part) {
			let potential = 0;
			if (part.type == ATTACK) {
				if (!part.boost) {
					potential = 1;
				} else if (part.boost == boostResources.attack[1]) {
					potential = BOOSTS.attack.UH.attack;
				} else if (part.boost == boostResources.attack[2]) {
					potential = BOOSTS.attack.UH2O.attack;
				} else if (part.boost == boostResources.attack[3]) {
					potential = BOOSTS.attack.XUH2O.attack;
				}
			}
			return potential * part.hits / 100;
		}));
	}

	static getAttackDamage(creep: Creep | Zerg): number {
		return ATTACK_POWER * this.getAttackPotential(toCreep(creep));
	}

	// Ranged attack potential of a single creep in units of effective number of parts
	static getRangedAttackPotential(creep: Creep): number {
		return this.cache(creep, 'rangedAttackPotential', () =>
			_.sum(creep.body, function (part) {
				let potential = 0;
				if (part.type == RANGED_ATTACK) {
					if (!part.boost) {
						potential = 1;
					} else if (part.boost == boostResources.ranged_attack[1]) {
						potential = BOOSTS.ranged_attack.KO.rangedAttack;
					} else if (part.boost == boostResources.ranged_attack[2]) {
						potential = BOOSTS.ranged_attack.KHO2.rangedAttack;
					} else if (part.boost == boostResources.ranged_attack[3]) {
						potential = BOOSTS.ranged_attack.XKHO2.rangedAttack;
					}
				}
				return potential * part.hits / 100;
			})
		);
	}

	static getRangedAttackDamage(creep: Creep | Zerg): number {
		return RANGED_ATTACK_POWER * this.getRangedAttackPotential(toCreep(creep));
	}

	// Attack potential of a single creep in units of effective number of parts
	static getDismantlePotential(creep: Creep): number {
		return this.cache(creep, 'dismantlePotential', () => _.sum(creep.body, function (part) {
			let potential = 0;
			if (part.type == WORK) {
				if (!part.boost) {
					potential = 1;
				} else if (part.boost == boostResources.dismantle[1]) {
					potential = BOOSTS.work.ZH.dismantle;
				} else if (part.boost == boostResources.dismantle[2]) {
					potential = BOOSTS.work.ZH2O.dismantle;
				} else if (part.boost == boostResources.dismantle[3]) {
					potential = BOOSTS.work.XZH2O.dismantle;
				}
			}
			return potential * part.hits / 100;
		}));
	}

	static getDismantleDamage(creep: Creep | Zerg): number {
		return DISMANTLE_POWER * this.getDismantlePotential(toCreep(creep));
	}

	// Minimum damage multiplier a creep has
	static minimumDamageTakenMultiplier(creep: Creep): number {
		return this.cache(creep, 'minDamageMultiplier', () =>
			_.min(_.map(creep.body, function (part) {
				if (part.type == TOUGH && part.hits > 0) {
					if (part.boost == boostResources.tough[1]) {
						return BOOSTS.tough.GO.damage;
					} else if (part.boost == boostResources.tough[2]) {
						return BOOSTS.tough.GHO2.damage;
					} else if (part.boost == boostResources.tough[3]) {
						return BOOSTS.tough.XGHO2.damage;
					}
				}
				return 1;
			}))
		);
	}

	static minimumDamageMultiplierForGroup(creeps: Creep[]): number {
		return _.min(_.map(creeps, creep => this.minimumDamageTakenMultiplier(creep)));
	}

	static getMassAttackDamageTo(attacker: Creep | Zerg, target: Creep | Structure): number {
		if (isStructure(target) && (!isOwnedStructure(target) || target.my)) {
			return 0;
		}
		let range = attacker.pos.getRangeTo(target.pos);
		let rangedMassAttackPower = 0;
		if (range <= 1) {
			rangedMassAttackPower = 10;
		} else if (range == 2) {
			rangedMassAttackPower = 4;
		} else if (range == 3) {
			rangedMassAttackPower = 1;
		}
		return rangedMassAttackPower * this.getRangedAttackPotential(isZerg(attacker) ? attacker.creep : attacker);
	}

	// Total damage to enemy creeps done by attacker.rangedMassAttack()
	static getMassAttackDamage(attacker: Creep | Zerg, targets = attacker.room.hostiles, checkRampart = true): number {
		let hostiles = attacker.pos.findInRange(targets, 3);
		return _.sum(hostiles, function (hostile) {
			if (checkRampart && hostile.pos.lookForStructure(STRUCTURE_RAMPART)) {
				return 0; // Creep inside rampart
			} else {
				return CombatIntel.getMassAttackDamageTo(attacker, hostile);
			}
		});
	}

	static rating(creep: Creep | Zerg): number {
		const c = toCreep(creep);
		return this.cache(c, 'rating', () => {
			let rating = this.getRangedAttackPotential(c) + this.getAttackPotential(c) / 2;
			let healMultiplier = 1 / this.minimumDamageTakenMultiplier(c);
			rating += healMultiplier * this.getHealPotential(c);
			return rating;
		});
	}

	// Group creep calculations ========================================================================================

	// Maximum damage that a group of creeps can dish out (doesn't count for simultaneity restrictions)
	static maxDamageByCreeps(creeps: Creep[]): number {
		return _.sum(creeps, creep => ATTACK_POWER * this.getAttackPotential(creep) +
									  RANGED_ATTACK_POWER * this.getRangedAttackPotential(creep));
	}

	// Maximum healing that a group of creeps can dish out (doesn't count for simultaneity restrictions)
	static maxHealingByCreeps(creeps: Creep[]): number {
		return _.sum(creeps, creep => this.getHealAmount(creep));
	}

	// Total attack/rangedAttack/heal potentials for a group of creeps
	static combatPotentials(creeps: Creep[]): { attack: number, rangedAttack: number, heal: number } {
		let attack = _.sum(creeps, creep => this.getAttackPotential(creep));
		let rangedAttack = _.sum(creeps, creep => this.getRangedAttackPotential(creep));
		let heal = _.sum(creeps, creep => this.getHealPotential(creep));
		return {attack, rangedAttack, heal};
	}

	// Maximum damage that is dealable at a given position by enemy forces
	static maxDamageAtPos(pos: RoomPosition): number {
		if (!pos.room) {
			return 0;
		}
		let hostilesInMeleeRange = _.filter(pos.room.dangerousHostiles, creep => pos.getRangeTo(creep) <= 1);
		let meleeDamage = _.sum(hostilesInMeleeRange, hostile => this.getAttackDamage(hostile));
		let hostilesInRange = _.filter(pos.room.dangerousHostiles, creep => pos.getRangeTo(creep) <= 3);
		let rangedDamage = _.sum(hostilesInRange, hostile => this.getRangedAttackDamage(hostile));
		let totalDamage = meleeDamage + rangedDamage;
		if (!pos.room.my) {
			totalDamage += this.towerDamageAtPos(pos) || 0;
		}
		return totalDamage;
	}

	// Heal potential of self and possible healer neighbors
	static maxHostileHealingTo(creep: Creep): number {
		return this.cache(creep, 'maxHostileHealing', () => {
			let selfHealing = this.getHealAmount(creep);
			let neighbors = _.filter(creep.room.hostiles, hostile => hostile.pos.isNearTo(creep));
			let neighborHealing = HEAL_POWER * _.sum(neighbors, neighbor => this.getHealPotential(neighbor));
			let rangedHealers = _.filter(creep.room.hostiles, hostile => hostile.pos.getRangeTo(creep) <= 3 &&
																		 !neighbors.includes(hostile));
			let rangedHealing = RANGED_HEAL_POWER * _.sum(rangedHealers, healer => this.getHealPotential(healer));
			return selfHealing + neighborHealing + rangedHealing;
		});
	}

	// Heal potential of self and possible healer neighbors
	static maxFriendlyHealingTo(friendly: Creep | Zerg): number {
		const creep = toCreep(friendly);
		return this.cache(creep, 'maxFriendlyHealing', () => {
			let selfHealing = this.getHealAmount(creep);
			let neighbors = _.filter(creep.room.creeps, hostile => hostile.pos.isNearTo(creep));
			let neighborHealing = HEAL_POWER * _.sum(neighbors, neighbor => this.getHealPotential(neighbor));
			let rangedHealers = _.filter(creep.room.creeps, hostile => hostile.pos.getRangeTo(creep) <= 3 &&
																	   !neighbors.includes(hostile));
			let rangedHealing = RANGED_HEAL_POWER * _.sum(rangedHealers, healer => this.getHealPotential(healer));
			return selfHealing + neighborHealing + rangedHealing;
		});
	}

	// Determine the predicted damage amount of a certain type of attack. Can specify if you should use predicted or
	// current hits amount and whether to include predicted healing. Does not update predicted hits.
	static predictedDamageAmount(attacker: Creep | Zerg, target: Creep, attackType: 'attack' | 'rangedAttack',
								 useHitsPredicted = true): number {
		// Compute initial (gross) damage amount
		let grossDamage: number;
		if (attackType == 'attack') {
			grossDamage = this.getAttackDamage(attacker);
		} else if (attackType == 'rangedAttack') {
			grossDamage = this.getRangedAttackDamage(attacker);
		} else { // rangedMassAttack; not currently used
			grossDamage = this.getMassAttackDamageTo(attacker, target);
		}
		// Adjust for remaining tough parts
		let toughHits: number;
		if (useHitsPredicted) {
			if (target.hitsPredicted == undefined) target.hitsPredicted = target.hits;
			let nonToughHits = _.sum(target.body, part => part.type == TOUGH ? 0 : part.hits);
			toughHits = Math.min(target.hitsPredicted - nonToughHits, 0); // predicted amount of TOUGH
		} else {
			toughHits = 100 * target.getActiveBodyparts(TOUGH);
		}
		let damageMultiplier = this.minimumDamageTakenMultiplier(target); // assumes only 1 tier of boosts
		if (grossDamage * damageMultiplier < toughHits) { // if you can't eat through armor
			return grossDamage * damageMultiplier;
		} else { // if you break tough shield
			grossDamage -= toughHits / damageMultiplier;
			return toughHits + grossDamage;
		}
	}

	// Creep position calculations =====================================================================================

	// // Distance from a given creep to the nearest rampart or wall; Infinity if no barriers in room
	// static distanceToBarrier(creep: Creep): number {
	//
	// }

	static isApproaching(approacher: Creep, toPos: RoomPosition): boolean {
		let previousPos = RoomIntel.getPreviousPos(approacher);
		let previousRange = toPos.getRangeTo(previousPos);
		let currentRange = toPos.getRangeTo(approacher.pos);
		return currentRange < previousRange;
	}

	static isRetreating(retreater: Creep, fromPos: RoomPosition): boolean {
		let previousPos = RoomIntel.getPreviousPos(retreater);
		let previousRange = fromPos.getRangeTo(previousPos);
		let currentRange = fromPos.getRangeTo(retreater.pos);
		return currentRange > previousRange;
	}

	static isEdgeDancing(creep: Creep, threshold = 5): boolean {
		// TODO
		console.log('NOT IMPLEMENTED');
		return false;
	}

	static getPositionsNearEnemies(hostiles: Creep[], range = 0): RoomPosition[] {
		return _.unique(_.flatten(_.map(hostiles, hostile =>
			hostile.pos.getPositionsInRange(range, false, true))));
	}

}