import {log} from '../../console/log';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectiveStronghold} from '../../directives/situational/stronghold';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {getCacheExpiration, posFromReadableName} from '../../utilities/utils';
import {Visualizer} from '../../visuals/Visualizer';
import {CombatZerg} from '../../zerg/CombatZerg';
import {CombatOverlord, CombatOverlordMemory} from '../CombatOverlord';


/**
 * Prioritized list of what order enemy structures should be attacked in
 */
export const StrongholdAttackPriorities: StructureConstant[] = [
	STRUCTURE_INVADER_CORE,
	STRUCTURE_TOWER,
	STRUCTURE_RAMPART,
	STRUCTURE_WALL,
];

interface StrongholdOverlordMemory extends CombatOverlordMemory {
	target?: {
		id: Id<Creep | Structure>;
		exp: number;
	};
	targetId?: string;
	attackingPosition?: string;
}

/**
 * Spawns ranged attacker against stronghold
 */
@profile
export class StrongholdOverlord extends CombatOverlord {

	memory: StrongholdOverlordMemory;
	strongholdKillers: CombatZerg[];
	room: Room | undefined;
	directive: DirectiveStronghold;
	_target: RoomObject | null;
	_attackPos?: RoomPosition;

	static settings = {
		retreatHitsPercent : 0.85,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveStronghold,
				priority = OverlordPriority.defense.rangedDefense) {
		super(directive, 'stronghold', priority, 1);
		this.strongholdKillers = this.combatZerg(Roles.strongholdKiller, {notifyWhenAttacked: false});
	}

	/**
	 * Returns [position, target] by searching for safe locations
	 * @param target
	 * @param range
	 * @param myCreep
	 */
	private findAttackingPositionAndTarget(target: Creep | Structure,
										   range: number,
										   myCreep: CombatZerg
	): { attackPos: RoomPosition, target: Creep | Structure } | undefined {
		log.info(`Finding attacking position in ${target.room} for ${this.print}`);
		if (!target.room || range == 0) {
			return;
		}

		// bug with containers
		const shootPositions = target.pos.getPositionsAtRange(range, false, false);

		// Index is range to avoid from
		const avoidLocs: RoomPosition[][] = Array.from({length: 5}, () => []);

		avoidLocs[1] = avoidLocs[1].concat(target.room.ramparts.map(rampart => rampart.pos));
		avoidLocs[4] = avoidLocs[4].concat(target.room.sources.map(s => s.pos));
		avoidLocs[4] = avoidLocs[4].concat(target.room.keeperLairs.map(s => s.pos));
		if (target.room.mineral) {
			avoidLocs[4] = avoidLocs[4].concat(target.room.mineral.pos);
		}

		// Array where first index is how many hostile locations there are
		const safeSpots: RoomPosition[][] = this.findSafeLocation(shootPositions, avoidLocs);
		_.forEach(safeSpots, (distanceArray, hostilesIndex) => distanceArray.forEach(
			spot => Visualizer.marker(spot, {color: StrongholdOverlord.numberToColor(hostilesIndex), frames: 2})));

		// If you can safely attack goal, do that
		if (safeSpots[0].length > 0) {
			const closestFirst = safeSpots[0].sort(((a, b) =>
				this.bestRampartToAttackSortFunction(a, b, myCreep.pos)));
			return {attackPos: closestFirst[0], target: target};
		} else if (safeSpots[1].length > 0) {
			// Can't safely attack target, need to attack another position first
			const range1Spots = safeSpots[1];
			const ramparts = target.room!.ramparts;
			const posToRampartMap: Map<RoomPosition, StructureRampart[]> = new Map();
			for (const spot of range1Spots) {
				for (const rampart of ramparts) {
					if (rampart.pos.isNearTo(spot)) {
						const temp: StructureRampart[] | undefined = posToRampartMap.get(spot);
						posToRampartMap.set(spot, !!temp ? temp.concat([rampart]) : [rampart]);
					}
				}
			}

			// Now select closest
			if (myCreep) {
				// TODO currently extra filtering, don't need from above
				const orderedByBest = Array.from(posToRampartMap.keys()).filter(
					p => posToRampartMap.get(p) && posToRampartMap.get(p)!.length == 1).sort(
					(a, b) => this.bestRampartToAttackSortFunction(a, b, myCreep.pos));
				for (const pos of orderedByBest) {
					const res = this.findAttackingPositionAndTarget(posToRampartMap.get(pos)![0], range - 1, myCreep);
					if (res) {
						return res;
					}
				}
			} else {
				for (const pos of posToRampartMap) {
					const res = this.findAttackingPositionAndTarget(pos[1][0]!, range - 1, myCreep);
					if (res) {
						return res;
					}
				}
			}
		}
		return;
	}

	get target(): Creep | Structure | undefined {
		if (this.memory.target && this.memory.target.exp > Game.time) {
			const target = Game.getObjectById(this.memory.target.id);
			if (target) {
				return target as Creep | Structure;
			}
		}
		// If nothing found
		delete this.memory.target;
	}

	set target(targ: Creep | Structure | undefined) {
		if (targ) {
			this.memory.target = {id: targ.id, exp: getCacheExpiration(3000)};
		} else {
			delete this.memory.target;
		}
	}


	bestRampartToAttackSortFunction(element1: RoomPosition, element2: RoomPosition, currentPos: RoomPosition,
									/*map: Map<RoomPosition, StructureRampart[]>*/) {
		// const numRamparts1 = map.get(element1) == undefined ? 10 : map.get(element1)!.length;
		// const numRamparts2 = map.get(element2) == undefined ? 10 : map.get(element2)!.length;
		return element1.getRangeTo(currentPos) - element2.getRangeTo(currentPos); // + (numRamparts1 - numRamparts2);
		// if (element.roomName == currentPos.roomName) {
		//
		// }
	}

	/**
	 * Returns double array of number of avoids per locations
	 * @param locations
	 * @param avoidLocationsAtDistance
	 */
	private findSafeLocation(locations: RoomPosition[], avoidLocationsAtDistance: RoomPosition[][]): RoomPosition[][] {
		// Index is number of hostiles present.
		const locationToHostilesMapping: RoomPosition[][] = Array.from({length: 8}, () => []);

		locations.forEach(loc => {
			let count = 0;
			avoidLocationsAtDistance.forEach((avoidArray, distance) => {
				avoidArray.forEach(avoidPos => {
					if (avoidPos.getRangeTo(loc) <= distance) {
						count++;
					}
				});
			});
			if (count < locationToHostilesMapping.length) {
				locationToHostilesMapping[count].push(loc);
			}
		});

		// Should probably do cost matrix to avoid ramparts, wrote a getNearRampartsMatrix in pathing but need to use it
		return locationToHostilesMapping;
	}

	private get attackPos(): RoomPosition | undefined {
		if (this._attackPos) {
			return this._attackPos;
		}
		if (this.memory.target && this.memory.attackingPosition) {
			this._attackPos = posFromReadableName(this.memory.attackingPosition);
			return this._attackPos;
		}
	}

	private handleKiller(killer: CombatZerg): void {
		if (Game.time % 15 == 0) {
			log.info(`Stronghold Killer ${killer.print} for ${this.print} in room ${killer.room.print}`);
		}

		if (this.room && killer.pos.roomName == this.pos.roomName) {
			if (this.directive.core && !this.memory.target) {
				const before = Game.cpu.getUsed();
				const targetingInfo = this.resetAttacking(this.directive.core, 3, killer);
				log.info(`CPU used for stronghold is ${Game.cpu.getUsed() - before}`);
			}
		}

		// TODO creep was an idiot and walked next to rampart moving to next attack position
		killer.heal(killer);

		if (killer.pos.roomName != this.pos.roomName) {
			killer.goToRoom(this.directive.pos.roomName);
		}
		if (killer.hits / killer.hitsMax < StrongholdOverlord.settings.retreatHitsPercent) {
			killer.flee([this.directive.pos].concat(killer.room.hostiles.map(sk => sk.pos)));
		}

		// Shoot nearby enemies before moving on
		const unprotectedHostiles = killer.room.hostiles.filter(hostile => hostile.pos.getRangeTo(killer.pos)
																		   <= 3 && !hostile.inRampart);
		if (unprotectedHostiles.length > 0) {
			killer.rangedAttack(unprotectedHostiles[0]);
			return;
		}
		if (this.memory.attackingPosition) {
			const attackPos = posFromReadableName(this.memory.attackingPosition);
			// In room and in position
			if (!attackPos || !killer.pos.isEqualTo(attackPos)) {
				let avoids: RoomPosition[] = [];
				if (this.directive.room) {
					avoids = avoids.concat(_.flatten(this.directive.room.sourceKeepers.map(
						source => source.pos.getPositionsInRange(3, false, false))));
					avoids = avoids.concat(_.flatten(this.directive.room.ramparts.map(
						ramparts => ramparts.pos.neighbors)));
					if (this.directive.room.mineral) {
						avoids = avoids.concat(
							this.directive.room.mineral.pos.getPositionsInRange(4, false, false));
					}
					avoids.forEach(av => Visualizer.circle(av));
					killer.goTo(attackPos!, {pathOpts: {obstacles: avoids}});
				}
			}
		}

		if (killer.pos.roomName == this.directive.pos.roomName) {
			if (this.target) {
				const res = killer.rangedAttack(this.target);
				if (res == ERR_INVALID_TARGET) {

				}
			} else {
				killer.goTo(this.pos);
				killer.rangedMassAttack();
				// killer.autoCombat(this.directive.pos.roomName);
			}
		}
	}

	static numberToColor(colorNumber: number) {
		switch (colorNumber) {
			case 0:
				return 'green';
			case 1:
				return 'yellow';
			case 2:
				return 'orange';
			default:
				return 'red';
		}
	}

	init() {
		if (this.memory.attackingPosition) {
			const attackPos = posFromReadableName(this.memory.attackingPosition);
			if (!!attackPos) {
				Visualizer.marker(attackPos, 'white');
			}
		}
		if (this.memory.target && Game.getObjectById(this.memory.target.id)) {
			const target = Game.getObjectById(this.memory.target.id) as RoomObject;
			if (target) {
				Visualizer.marker(target.pos, 'black');
			}
		}

		if (this.directive.memory.state >= 3) {
			return; // No need to spawn more
		}
		// log.info(`Setting up body type for ${this.print} with ${this.directive.memory.strongholdLevel}`);

		let setup;
		// TODO fix me for when strongholds typescript is out
		switch (this.directive.memory.strongholdLevel) {
			case 5:
				return; // Fuck this shit we out
			case 4:
				return;
			// setup = CombatSetups.strongholdKiller["4"];
			// break;
			case 3:
				setup = CombatSetups.strongholdKiller['3'];
				break;
			case 2:
				setup = CombatSetups.strongholdKiller['2'];
				break;
			case 1:
				setup = CombatSetups.strongholdKiller['1'];
				break;
			case 0:
				return; // Forget it, no need for the lil ones
			default:
				return;// setup = CombatSetups.strongholdKiller["3"];
		}

		// if (!this.canBoostSetup(setup)) {// TODO: need to move this to the new CombatCreepSetup system
		// 	// Need boosts
		// 	return log.error(`Can't boost stronghold killer in ${this.print}!`);
		// }
		//
		// this.wishlist(1, setup, {});
	}


	private resetAttacking(ultimateGoal: Creep | Structure, maxRange: number, myCreep: CombatZerg) {
		const targetingInfo = this.findAttackingPositionAndTarget(ultimateGoal, 3, myCreep);
		if (targetingInfo) {
			this.target = targetingInfo.target;
			this.memory.attackingPosition = targetingInfo.attackPos.readableName;
		}
		return targetingInfo;
	}

	run() {
		const avoids: RoomPosition[] = [];
		// if (this.directive.room) {
		// 	avoids = avoids.concat(_.flatten(this.directive.room.sources.map(source =>
		// 	source.pos.getPositionsInRange(4, false, false))));
		// 	avoids = avoids.concat(_.flatten(this.directive.room.ramparts.map(ramparts => ramparts.pos.neighbors)));
		// 	if (this.directive.room.mineral) {
		// 		avoids = avoids.concat(this.directive.room.mineral.pos.getPositionsInRange(4, false, false))
		// 	}
		// }
		// avoids.forEach(av => Visualizer.circle(av, 'blue'));
		// log.info(`Running stronghold overlord ${this.print}`);
		this.autoRun(this.strongholdKillers, killer => this.handleKiller(killer));
	}
}
