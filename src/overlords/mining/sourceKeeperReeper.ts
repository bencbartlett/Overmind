// SourceReaperOverlord -- spawns offensive creeps to allow source keeper mining

import {CombatZerg} from '../../zerg/CombatZerg';
import {DirectiveSKOutpost} from '../../directives/colony/outpostSK';
import {RoomIntel} from '../../intel/RoomIntel';
import {minBy} from '../../utilities/utils';
import {Mem} from '../../memory/Memory';
import {debug, log} from '../../console/log';
import {CombatTargeting} from '../../targeting/CombatTargeting';
import {Movement} from '../../movement/Movement';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {Visualizer} from '../../visuals/Visualizer';
import {profile} from '../../profiler/decorator';
import {CombatOverlord} from '../CombatOverlord';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {OverlordMemory} from '../Overlord';

interface SourceReaperOverlordMemory extends OverlordMemory {
	targetLairID?: string;
}

@profile
export class SourceReaperOverlord extends CombatOverlord {

	static requiredRCL = 7;

	directive: DirectiveSKOutpost;
	memory: SourceReaperOverlordMemory;
	targetLair: StructureKeeperLair | undefined;

	reapers: CombatZerg[];
	defenders: CombatZerg[];

	constructor(directive: DirectiveSKOutpost, priority = OverlordPriority.remoteSKRoom.sourceReaper) {
		super(directive, 'sourceReaper', priority, SourceReaperOverlord.requiredRCL);
		this.directive = directive;
		this.priority += this.outpostIndex * OverlordPriority.remoteSKRoom.roomIncrement;
		this.reapers = this.combatZerg(Roles.melee);
		this.defenders = this.combatZerg(Roles.ranged);
		this.memory = Mem.wrap(this.directive.memory, 'sourceReaper');
		this.computeTargetLair();
	}

	private computeTargetLair() {
		this.targetLair = this.memory.targetLairID ? <StructureKeeperLair>deref(this.memory.targetLairID) : undefined;
		if (!this.targetLair || (this.targetLair.ticksToSpawn || Infinity) >= 299) {
			this.targetLair = this.getNextTargetLair();
		}
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, 'sourceReaper');
		this.computeTargetLair();
	}

	init() {
		let defenderAmount = this.room && (this.room.invaders.length > 0
										   || RoomIntel.isInvasionLikely(this.room)) ? 1 : 0;
		this.wishlist(1, CombatSetups.zerglings.sourceKeeper);
		this.wishlist(defenderAmount, CombatSetups.hydralisks.sourceKeeper);
	}

	private getNextTargetLair(): StructureKeeperLair | undefined {
		if (!this.room) return;
		// If any lairs have an active keeper, target that
		let activeLair = _.find(this.room.keeperLairs,
								lair => lair.pos.findInRange(lair.room.sourceKeepers, 5).length > 0);
		if (activeLair) return activeLair;
		// Otherwise target whatever is closest to spawning
		return minBy(this.room.keeperLairs,
					 lair => lair.ticksToSpawn || Infinity); // not sure why ticksToSpawn is number | undefined
	}

	private handleReaper(reaper: CombatZerg) {

		// Go to keeper room
		if (!this.targetLair || !this.room || reaper.room != this.room || reaper.pos.isEdge) {
			// log.debugCreep(reaper, `Going to room!`);
			reaper.healSelfIfPossible();
			reaper.goTo(this.pos);
			return;
		}

		if (this.room.invaders.length > 0) {
			// Handle invader actions
			// log.debugCreep(reaper, `Handling invader actions!`);
			if (reaper.hits >= reaper.hitsMax * .5) {
				let result = reaper.autoMelee(this.room.invaders);
				if (result == undefined) { // didn't attack
					reaper.autoHeal();
				}
			} else {
				reaper.healSelfIfPossible();
			}
			// Kite around ranged invaders until a defender arrives
			if (this.room.invaders.length > 2 && _.filter(this.defenders, def => def.room == this.room).length == 0) {
				reaper.kite(_.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(RANGED_ATTACK) > 0));
				reaper.healSelfIfPossible();
			}
			// If defender is already here or a small invasion
			else {
				let target = CombatTargeting.findTarget(reaper, this.room.invaders);
				if (target) {
					Movement.invasionMove(reaper, target);
				} else {
					log.warning(`KeeperReaper@${reaper.pos.print}: no invader target!`);
				}
			}
		} else {
			// log.debugCreep(reaper, `Standard keeperReaper actions`);
			// Standard keeperReaper actions
			let nearestHostile = reaper.pos.findClosestByRange(this.room.hostiles) as Creep;
			if (nearestHostile && reaper.pos.isNearTo(nearestHostile)) {
				reaper.attack(nearestHostile);
				reaper.move(reaper.pos.getDirectionTo(nearestHostile));
			} else {
				let keeper = this.targetLair.pos.findClosestByLimitedRange(this.room.sourceKeepers, 7);
				if (keeper) { // attack the source keeper
					// stop and heal at range 4 if needed
					let approachRange = (reaper.hits == reaper.hitsMax || reaper.pos.getRangeTo(keeper) <= 3) ? 1 : 4;
					reaper.goTo(keeper, {range: approachRange});
				} else { // travel to next lair
					reaper.goTo(this.targetLair, {range: 1});
				}
			}
			reaper.healSelfIfPossible();
		}

	}

	private handleDefender(defender: CombatZerg) {

		// Go to keeper room
		if (!this.targetLair || !this.room || defender.room != this.room || defender.pos.isEdge) {
			debug(defender, `Going to room!`);
			defender.healSelfIfPossible();
			defender.goToRoom(this.pos.roomName);
			return;
		}

		if (this.room.invaders.length > 0) {
			// Handle invader actions
			debug(defender, `AutoCombat`);
			defender.autoSkirmish(this.room.name);

		} else {
			debug(defender, `Standard duty`);
			let minKeepersToHelp = this.reapers.length == 0 ? 1 : 2;
			if (this.room.sourceKeepers.length >= minKeepersToHelp) {
				// Help out with keeper reaping
				defender.autoRanged();
				defender.autoHeal(false);

				let reaper = defender.pos.findClosestByRange(this.reapers);
				if (reaper) {
					defender.goTo(reaper, {
						movingTarget: defender.pos.getRangeTo(reaper) > 8,
						maxRooms    : 1,
						repath      : 0.1
					});
				} else {
					let keeper = this.targetLair.pos.findClosestByLimitedRange(this.room.sourceKeepers, 7);
					if (keeper) { // attack the source keeper
						let range = defender.pos.getRangeTo(keeper);
						let keepAtRange = defender.hits < defender.hitsMax * .9 ? 4 : 3;
						if (range < keepAtRange) {
							defender.kite(this.room.hostiles, {range: keepAtRange});
						} else if (range > keepAtRange) {
							defender.goTo(keeper, {maxRooms: 1, range: keepAtRange});
						}
					} else { // travel to next lair
						defender.goTo(this.targetLair, {range: 5});
					}
				}
			} else {
				// Do medic actions
				debug(defender, `Medic actions`);
				defender.doMedicActions(this.room.name);
			}
		}

	}

	run() {
		this.autoRun(this.reapers, reaper => this.handleReaper(reaper));
		this.autoRun(this.defenders, defender => this.handleDefender(defender));
	}

	visuals() {
		if (this.room && this.targetLair) {
			Visualizer.marker(this.targetLair.pos);
		}
	}

}
