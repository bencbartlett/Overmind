import {Overlord} from '../Overlord';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {log} from '../../console/log';
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
	totalCollected: number;

	// TODO bug where haulers can come from tiny rooms not ready yet
	requiredRCL = 6;
	// Allow time for body to spawn
	prespawnAmount = 350;

	constructor(directive: DirectivePowerMine, priority = OverlordPriority.collectionUrgent.haul) {
		super(directive, 'powerHaul', priority);
		this.directive = directive;
		this.haulers = this.zerg(Roles.transport);
		this.totalCollected = this.totalCollected || 0;
		// Spawn haulers to collect ALL the power at the same time.
		let haulingPartsNeeded = this.directive.totalResources/CARRY_CAPACITY;
		// Calculate amount of hauling each hauler provides in a lifetime
		let haulerCarryParts = Setups.transporters.default.getBodyPotential(CARRY, this.colony);
		// Calculate number of haulers
		this.numHaulers = Math.ceil(haulingPartsNeeded/haulerCarryParts);
		// setup time to request the haulers
		this.tickToSpawnOn = Game.time + (this.directive.calculateRemainingLifespan() || 0) - this.prespawnAmount;
	}

	init() {
		if (!this.colony.storage || _.sum(this.colony.storage.store) > Energetics.settings.storage.total.cap) {
			return;
		}
	}

	protected handleHauler(hauler: Zerg) {
		if (_.sum(hauler.carry) == 0) {
			if (this.directive.memory.state >= 4) {
				// FIXME: Maybe ditch this and put it as a separate on-finishing method to reassign
				hauler.say('💀 RIP 💀',true);
				log.warning(`${hauler.name} is committing suicide as directive is done!`);
				this.numHaulers = 0;
				hauler.retire();
			}
			// Travel to directive and collect resources
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
				} else if (this.room && this.room.drops) {
					let allDrops: Resource[] = _.flatten(_.values(this.room.drops));
					let drop = allDrops[0];
					if (drop) {
						hauler.task = Tasks.pickup(drop);
						return;
					} else {
						hauler.say('💀 RIP 💀',true);
						log.warning(`${hauler.name} is committing suicide!`);
						hauler.retire();
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
						this.totalCollected += hauler.carry.power || 0;
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

	checkIfStillCarryingPower() {
		return _.find(this.haulers, hauler => hauler.carry.power != undefined && hauler.carry.power > 0);
	}

	run() {
		if (Game.time >= this.tickToSpawnOn && this.directive.memory.state < 4) {
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