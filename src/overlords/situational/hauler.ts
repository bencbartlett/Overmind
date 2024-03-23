import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveHaul} from '../../directives/resource/haul';
import {Energetics} from '../../logistics/Energetics';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

/**
 * Spawns special-purpose haulers for transporting resources to/from a specified target
 */
@profile
export class HaulingOverlord extends Overlord {

	haulers: Zerg[];
	directive: DirectiveHaul;

	requiredRCL: 4;

	constructor(directive: DirectiveHaul, priority = directive.hasDrops ? OverlordPriority.collectionUrgent.haul :
													 OverlordPriority.tasks.haul) {
		super(directive, 'haul', priority);
		this.directive = directive;
		this.haulers = this.zerg(Roles.transport);
	}

	init() {
		if (!this.colony.storage || this.colony.storage.store.getUsedCapacity() > Energetics.settings.storage.total.cap) {
			return;
		}
		// Spawn a number of haulers sufficient to move all resources within a lifetime, up to a max
		const MAX_HAULERS = 5;
		// Calculate total needed amount of hauling power as (resource amount * trip distance)
		const tripDistance = 2 * (Pathing.distance((this.colony.storage || this.colony).pos, this.directive.pos) || 0);
		const haulingPowerNeeded = Math.min(this.directive.totalResources,
											this.colony.storage.store.getCapacity()
											- this.colony.storage.store.getUsedCapacity()) * tripDistance;
		// Calculate amount of hauling each hauler provides in a lifetime
		const haulerCarryParts = Setups.transporters.early.getBodyPotential(CARRY, this.colony);
		const haulingPowerPerLifetime = CREEP_LIFE_TIME * haulerCarryParts * CARRY_CAPACITY;
		// Calculate number of haulers
		const numHaulers = Math.min(Math.ceil(haulingPowerNeeded / haulingPowerPerLifetime), MAX_HAULERS);
		// Request the haulers
		this.wishlist(numHaulers, Setups.transporters.early);
	}

	private handleHauler(hauler: Zerg) {
		if (hauler.store.getUsedCapacity() == 0) {
			// Travel to directive and collect resources
			if (hauler.inSameRoomAs(this.directive)) {
				// Pick up drops first
				if (this.directive.hasDrops) {
					const allDrops: Resource[] = _.flatten(_.values(this.directive.drops));
					const drop = _.find(allDrops, drop => drop.resourceType != 'energy') || allDrops[0];
					if (drop) {
						hauler.task = Tasks.pickup(drop);
						return;
					}
				}
				// Withdraw from store structure
				if (this.directive.storeStructure) {
					const store = this.directive.store!;
					let totalDrawn = 0; // Fill to full
					for (const resourceType of <ResourceConstant[]>Object.keys(store)) {
						if (store[resourceType] > 0) {
							if (hauler.task) {
								hauler.task = Tasks.withdraw(this.directive.storeStructure, <ResourceConstant>resourceType).fork(hauler.task);
							} else {
								hauler.task = Tasks.withdraw(this.directive.storeStructure, <ResourceConstant>resourceType);
							}
							totalDrawn += store[resourceType];
							if (totalDrawn >= hauler.store.getCapacity()) {
								return;
							}
						}
					}
					if (hauler.task) {
						// If can't fill up, just go ahead and go home
						// log.notify(`Can't finish filling up ${totalDrawn} ${JSON.stringify(hauler.task)} ${this.room}`);
						return;
					}
				}
				// Shouldn't reach here
				log.warning(`${hauler.name} in ${hauler.room.print}: nothing to collect!`);
			} else {
				// hauler.task = Tasks.goTo(this.directive);
				hauler.goTo(this.directive, {pathOpts: {avoidSK: true}});
			}
		} else {
			// Travel to colony room and deposit resources
			if (hauler.inSameRoomAs(this.colony)) {
				// Put energy in storage and minerals in terminal if there is one
				for (const [resourceType, amount] of hauler.store.contents) {
					if (amount == 0) continue;
					if (resourceType == RESOURCE_ENERGY) { // prefer to put energy in storage
						if (this.colony.storage && this.colony.storage.store.getUsedCapacity() < STORAGE_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.storage, resourceType);
							return;
						} else if (this.colony.terminal && this.colony.terminal.store.getUsedCapacity() < TERMINAL_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.terminal, resourceType);
							return;
						}
					} else { // prefer to put minerals in terminal
						if (this.colony.terminal && this.colony.terminal.my
							&& this.colony.terminal.store.getUsedCapacity() < TERMINAL_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.terminal, resourceType);
							return;
						} else if (this.colony.storage && this.colony.storage.store.getUsedCapacity() < STORAGE_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.storage, resourceType);
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
		for (const hauler of this.haulers) {
			if (hauler.isIdle) {
				this.handleHauler(hauler);
			}
			hauler.run();
		}
		// TODO: fix the way this is done
		if (this.directive.memory.totalResources == 0 && this.haulers.filter(hauler => hauler.store.getUsedCapacity() > 0).length == 0) {
			this.directive.remove();
		}
	}
}
