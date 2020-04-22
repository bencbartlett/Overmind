import {Colony} from '../../Colony';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveRemoteUpgrade} from '../../directives/situational/remoteUpgrade';
import {UpgradeSite} from '../../hiveClusters/upgradeSite';
import {CombatIntel} from '../../intel/CombatIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {BASE_RESOURCES, BOOSTS_T1, BOOSTS_T2, BOOSTS_T3, INTERMEDIATE_REACTANTS} from '../../resources/map_resources';
import {Tasks} from '../../tasks/Tasks';
import {maxBy, minBy} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

// The order in which resources are handled within the network
const highPriorityLoot: ResourceConstant[] = [
	...BOOSTS_T3,
	RESOURCE_OPS,
	RESOURCE_POWER,
];
const lowPriorityLoot: ResourceConstant[] = [
	...BOOSTS_T2,
	...BOOSTS_T1,
	...INTERMEDIATE_REACTANTS,
	...BASE_RESOURCES,
];
const dontLoot: ResourceConstant[] = [
	RESOURCE_ENERGY,
];
const everythingElse = _.filter(RESOURCES_ALL,
								res => !(highPriorityLoot.includes(res) || lowPriorityLoot.includes(res))
									   && !dontLoot.includes(res));

const LOOTING_ORDER: ResourceConstant[] = [...highPriorityLoot,
										   ...everythingElse,
										   ...lowPriorityLoot];


/**
 * Spawns remote upgraders and energy carriers to travel to a distant room to upgrade the controller. The directive
 * should be placed on the controller in the child room and should only be used after the room has been claimed.
 */
@profile
export class RemoteUpgradingOverlord extends Overlord {

	private directive: DirectiveRemoteUpgrade;

	parentColony: Colony;
	childColony: Colony;

	upgraders: Zerg[];
	carriers: Zerg[];

	private boosted: boolean;

	upgradeSite: UpgradeSite;
	room: Room;	//  Operates in owned room

	constructor(directive: DirectiveRemoteUpgrade, priority = OverlordPriority.colonization.remoteUpgrading) {
		super(directive, 'remoteUpgrade', priority);

		this.directive = directive;

		this.parentColony = this.colony;
		this.childColony = Overmind.colonies[this.pos.roomName];
		if (!this.childColony) {
			log.error(`${this.print}: no child colony! (Why?)`);
		}
		if (this.parentColony == this.childColony) {
			log.error(`${this.print}: parent and child colonies are the same! (Why?)`);
		}
		this.upgradeSite = this.childColony.upgradeSite;
		// If new colony or boosts overflowing to storage
		this.carriers = this.zerg(Roles.transport);
		this.upgraders = this.zerg(Roles.upgrader);

		this.boosted = true; // TODO
	}

	/**
	 * Computes the amount of carry capacity (in terms of energy units, not bodyparts) needed
	 */
	private computeNeededCarrierCapacity(): number {
		if (this.childColony.terminal && this.childColony.terminal.my) {
			return 0; // don't need this once you have a terminal
		}
		const roundTripDistance = 1.5 /* todo */ * this.directive.distanceFromColony.terrainWeighted;
		const energyPerTick = _.sum(this.upgraders,
									upgrader => UPGRADE_CONTROLLER_POWER * upgrader.getActiveBodyparts(WORK));
		return energyPerTick * roundTripDistance;
	}

	init() {
		let neededCarriers = this.carriers.length;
		if (this.carriers.length == 0) {
			neededCarriers = 1;
		} else {
			const neededCarryCapacity = this.computeNeededCarrierCapacity();
			const currentCarryCapacity = _.sum(this.carriers, carrier =>
				CARRY_CAPACITY * CombatIntel.getCarryPotential(carrier.creep, true));
			const avgCarrierCapactiy = currentCarryCapacity / this.carriers.length;
			this.debug(`Needed carry capacity: ${neededCarryCapacity}; Current carry capacity: ${currentCarryCapacity}`);
			neededCarriers = Math.ceil(neededCarryCapacity / avgCarrierCapactiy);
			this.debug(`Needed carriers: ${neededCarriers}`);
		}

		if (this.boosted) {
			this.wishlist(neededCarriers, Setups.transporters.boosted, {priority: this.priority});
			this.wishlist(8, Setups.upgraders.remote_boosted, {priority: this.priority + 1});
		} else {
			this.wishlist(neededCarriers, Setups.transporters.default, {priority: this.priority});
			this.wishlist(8, Setups.upgraders.remote, {priority: this.priority + 1});
		}
	}

	private handleUpgrader(upgrader: Zerg): void {
		// Go to the room and don't pick up energy until you're there
		if (!upgrader.safelyInRoom(this.childColony.room.name)) {
			upgrader.goToRoom(this.childColony.room.name);
			return;
		}
		// You're in the room, upgrade if you have energy
		if (upgrader.carry.energy > 0) {
			upgrader.task = Tasks.upgrade(this.upgradeSite.controller);
			return;
		}
		// If you're out of energy, recharge from link or battery
		if (this.upgradeSite.link && this.upgradeSite.link.energy > 0) {
			upgrader.task = Tasks.withdraw(this.upgradeSite.link);
			return;
		}
		if (this.upgradeSite.battery && this.upgradeSite.battery.energy > 0) {
			upgrader.task = Tasks.withdraw(this.upgradeSite.battery);
			return;
		}
		// Recharge from transporter?
		const nearbyCarriers = _.filter(this.carriers, carrier => upgrader.pos.getRangeTo(carrier) <= 5);
		const nearbyCarriersWaitingToUnload = _.filter(nearbyCarriers, carrier => carrier.carry.energy > 0);
		const lowestEnergyCarrier = minBy(nearbyCarriersWaitingToUnload, carrier => carrier.carry.energy);
		if (lowestEnergyCarrier) {
			upgrader.goTo(lowestEnergyCarrier);
			return;
		} else {
			// Just recharge how you normally would
			upgrader.task = Tasks.recharge();
		}
	}

	private handleCarrier(carrier: Zerg): void {

		if (carrier.getActiveBodyparts(HEAL) > 0) {
			carrier.heal(carrier);
		}

		// Get energy from the parent colony if you need it
		if (carrier.carry.energy == 0) {
			// If you are in the child room and there are valuable resources in a storage/terminal that isn't mine,
			// then take those back before you go home
			if (carrier.room == this.childColony.room && carrier.carry.getFreeCapacity() > 0) {
				const storeStructuresNotMy =
						  _.filter(_.compact([this.childColony.room.storage,
											  this.childColony.room.terminal]),
								   structure => !structure!.my) as (StructureStorage | StructureTerminal)[];
				for (const resource of LOOTING_ORDER) {
					const withdrawTarget = _.find(storeStructuresNotMy,
												  structure => structure.store.getUsedCapacity(resource) > 0);
					if (withdrawTarget) {
						const amount = Math.min(withdrawTarget.store.getUsedCapacity(resource),
												carrier.carry.getFreeCapacity());
						carrier.task = Tasks.withdraw(withdrawTarget, resource, amount);
						return;
					}
				}
			}
			// Go to the parent room for energy
			if (!carrier.safelyInRoom(this.parentColony.room.name)) {
				carrier.goToRoom(this.parentColony.room.name);
				return;
			}

			const target = _.find(_.compact([this.parentColony.storage, this.parentColony.terminal]),
								  s => s!.store[RESOURCE_ENERGY] >= carrier.carryCapacity);
			if (!target) {
				log.warning(`${this.print}: no energy withdraw target for ${carrier.print}!`);
				return;
			}
			if (carrier.carry.getUsedCapacity() > carrier.carry.getUsedCapacity(RESOURCE_ENERGY)) {
				carrier.task = Tasks.transferAll(target);
			} else {
				carrier.task = Tasks.withdraw(target);
			}

		} else {

			// Go to the room
			if (!carrier.safelyInRoom(this.childColony.room.name)) {
				carrier.goToRoom(this.childColony.room.name);
				return;
			}

			// Try to deposit in container, unless there's already a crowd waiting there;
			// otherwise put in storage if you can
			const depositPos = this.upgradeSite.batteryPos || this.upgradeSite.pos;
			const carriersWaitingToUnload = _.filter(this.carriers, carrier =>
				carrier.carry.energy > 0 && carrier.pos.inRangeToPos(depositPos, 5));
			const firstCarrierInQueue = minBy(carriersWaitingToUnload, carrier =>
				carrier.carry.energy + (carrier.ticksToLive || Infinity) / 10000);

			// Put in storage if you can
			if (this.childColony.storage && firstCarrierInQueue && firstCarrierInQueue != carrier) {
				carrier.task = Tasks.transfer(this.childColony.storage);
				return;
			}

			// Otherwise go to the dropoff point
			const range = firstCarrierInQueue && carrier == firstCarrierInQueue ? 0 : 3;
			if (!carrier.pos.inRangeToPos(depositPos, range)) {
				const ret = carrier.goTo(depositPos);
				return;
			}

			// Otherwise try to transfer to any empty upgraders
			if (carrier == firstCarrierInQueue) {
				// Once you're nearby try to deposit in the battery if there is one
				if (this.upgradeSite.battery && this.upgradeSite.battery.store.getFreeCapacity() > 0) {
					if (carrier.transfer(this.upgradeSite.battery) == OK) return;
				}
				// Carriers should unload one at a time
				const upgraderTransferTarget = maxBy(_.filter(this.upgraders, upgrader => upgrader.pos.isNearTo(carrier)),
													 upgrader => upgrader.store.getFreeCapacity());
				if (upgraderTransferTarget) {
					if (carrier.transfer(upgraderTransferTarget) == OK) return;
				}
			}

		}
	}

	run() {
		this.autoRun(this.upgraders, upgrader => this.handleUpgrader(upgrader));
		this.autoRun(this.carriers, carrier => this.handleCarrier(carrier));
	}
}
