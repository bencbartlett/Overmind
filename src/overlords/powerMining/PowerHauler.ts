import {Overlord} from '../Overlord';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {log} from '../../console/log';
import {Pathing} from '../../movement/Pathing';
import {Energetics} from '../../logistics/Energetics';
import {profile} from '../../profiler/decorator';
import {Roles, Setups} from '../../creepSetups/setups';
import {calculateFormationStrength} from "../../utilities/creepUtils";
import {DirectivePowerMine} from "../../directives/resource/powerMine";

/**
 * Spawns special-purpose haulers for transporting resources to/from a specified target
 */
@profile
export class PowerHaulingOverlord extends Overlord {

	haulers: Zerg[];
	directive: DirectivePowerMine;
	tickToSpawnOn: number;
	numHaulers: number;

	requiredRCL = 6;
	// Allow time for body to spawn
	prespawnAmount = 250;

	constructor(directive: DirectivePowerMine, priority = OverlordPriority.collectionUrgent.haul) {
		super(directive, 'powerHaul', priority);
		this.directive = directive;
		this.haulers = this.zerg(Roles.transport);
	}

	init() {
		if (!this.colony.storage || _.sum(this.colony.storage.store) > Energetics.settings.storage.total.cap) {
			return;
		}
		// Spawn haulers to collect ALL the power at the same time.
		let haulingPartsNeeded = this.directive.totalResources/50;
		// Calculate amount of hauling each hauler provides in a lifetime
		let haulerCarryParts = Setups.transporters.default.getBodyPotential(CARRY, this.colony);
		// Calculate number of haulers
		this.numHaulers = Math.round(haulingPartsNeeded/haulerCarryParts);
		// setup time to request the haulers
		this.tickToSpawnOn = Game.time + (this.calculateRemainingLifespan() || 0) - this.prespawnAmount;
	}

	/**
	 * Calculates how many remaining ticks the power bank has left at current kill rate
	 */
	calculateRemainingLifespan() {
		if (!this.room) {
			return undefined;
		} else if (this.directive.powerBank == undefined) {
			// Power Bank is gone
			return 0;
		} else {
			let tally = calculateFormationStrength(this.directive.powerBank.pos.findInRange(FIND_MY_CREEPS, 4));
			let healStrength: number = tally.heal * HEAL_POWER || 0;
			let attackStrength: number = tally.attack * ATTACK_POWER || 0;
			// PB have 50% hitback, avg damage is attack strength if its enough healing, otherwise healing
			let avgDamagePerTick = Math.min(attackStrength, healStrength*2);
			return this.directive.powerBank.hits / avgDamagePerTick;
		}
	}

	protected handleHauler(hauler: Zerg) {
		if (_.sum(hauler.carry) == 0) {
			// Travel to directive and collect resources
			if (this.directive.haulingDone) {
				hauler.say('💀 RIP 💀',true);
				log.warning(`${hauler.name} is committing suicide as directive is done!`);
				this.numHaulers = 0;
				hauler.suicide();
			}
			if (hauler.inSameRoomAs(this.directive)) {
				// Pick up drops first
				if (this.directive.hasDrops) {
					let allDrops: Resource[] = _.flatten(_.values(this.directive.drops));
					let drop = allDrops[0];
					if (drop) {
						hauler.task = Tasks.pickup(drop);
						return;
					}
				} else if (this.directive.powerBank) {
					if (hauler.pos.getRangeTo(this.directive.powerBank) > 4) {
						hauler.goTo(this.directive.powerBank);
					} else {
						hauler.say('🚬', true);
					}
					return;
				} else if (this.room &&  this.room.drops) {
					let allDrops: Resource[] = _.flatten(_.values(this.room.drops));
					let drop = allDrops[0];
					if (drop) {
						hauler.task = Tasks.pickup(drop);
						return;
					} else {
						hauler.say('💀 RIP 💀',true);
						log.warning(`${hauler.name} is committing suicide!`);
						hauler.suicide();
						return;
					}
				}
				// Shouldn't reach here
				log.warning(`${hauler.name} in ${hauler.room.print}: nothing to collect!`);
			} else {
				hauler.goTo(this.directive);
			}
		} else {
			// Travel to colony room and deposit resources
			if (hauler.inSameRoomAs(this.colony)) {
				for (let resourceType in hauler.carry) {
					if (hauler.carry[<ResourceConstant>resourceType] == 0) continue;
					if (resourceType == RESOURCE_ENERGY) { // prefer to put energy in storage
						if (this.colony.storage && _.sum(this.colony.storage.store) < STORAGE_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.storage, resourceType);
							return;
						} else if (this.colony.terminal && _.sum(this.colony.terminal.store) < TERMINAL_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.terminal, resourceType);
							return;
						}
					} else { // prefer to put minerals in terminal
						if (this.colony.terminal && _.sum(this.colony.terminal.store) < TERMINAL_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.terminal, <ResourceConstant>resourceType);
							return;
						} else if (this.colony.storage && _.sum(this.colony.storage.store) < STORAGE_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.storage, <ResourceConstant>resourceType);
							return;
						}
					}
				}
				// Shouldn't reach here
				log.warning(`${hauler.name} in ${hauler.room.print}: nowhere to put resources!`);
			} else {
				hauler.task = Tasks.goToRoom(this.colony.room.name);
			}
		}
	}

	run() {
		if (Game.time >= this.tickToSpawnOn) {
			Game.notify('Time to spawn haulers ' + this.pos.roomName);
			this.wishlist(this.numHaulers, Setups.transporters.default);
		}
		for (let hauler of this.haulers) {
			if (hauler.isIdle) {
				this.handleHauler(hauler);
			}
			hauler.run();
		}
	}
}