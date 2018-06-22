import {Overlord} from '../Overlord';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Colony, ColonyStage} from '../../Colony';
import {
	ALL_RESOURCE_TYPE_ERROR,
	BufferTarget,
	LogisticsNetwork,
	LogisticsRequest
} from '../../logistics/LogisticsNetwork';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {Pathing} from '../../movement/Pathing';
// import {DirectivePickup} from '../../directives/logistics/logisticsRequest';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';
import {isResource, isStoreStructure, isTombstone} from '../../declarations/typeGuards';
import {log} from '../../console/log';


export const TransporterSetup = new CreepSetup('transport', {
	pattern  : [CARRY, CARRY, MOVE],
	sizeLimit: Infinity,
});

export const TransporterEarlySetup = new CreepSetup('transport', {
	pattern  : [CARRY, MOVE],
	sizeLimit: Infinity,
});


@profile
export class TransportOverlord extends Overlord {

	transporters: Zerg[];
	logisticsGroup: LogisticsNetwork;

	constructor(colony: Colony, priority = colony.getCreepsByRole(TransporterSetup.role).length > 0 ?
										   OverlordPriority.ownedRoom.transport : OverlordPriority.ownedRoom.firstTransport) {
		super(colony, 'logistics', priority);
		this.transporters = this.creeps(TransporterSetup.role);
		this.logisticsGroup = colony.logisticsNetwork;
	}

	private neededTransportPower(): number {
		let transportPower = 0;
		let scaling = this.colony.stage == ColonyStage.Larva ? 1.5 : 1.75; // aggregate round-trip multiplier
		// Add contributions to transport power from hauling energy from mining sites
		let dropoffLocation: RoomPosition;
		if (this.colony.commandCenter) {
			dropoffLocation = this.colony.commandCenter.pos;
		} else if (this.colony.hatchery && this.colony.hatchery.battery) {
			dropoffLocation = this.colony.hatchery.battery.pos;
		} else {
			return 0;
		}
		for (let siteID in this.colony.miningSites) {
			let site = this.colony.miningSites[siteID];
			if (site.overlord.miners.length > 0) {
				// Only count sites which have a container output and which have at least one miner present
				// (this helps in difficult "rebooting" situations)
				if (site.output && site.output instanceof StructureContainer) {
					transportPower += site.energyPerTick * (scaling * Pathing.distance(site.pos, dropoffLocation));
				} else if (site.shouldDropMine) {
					transportPower += .75 * site.energyPerTick * (scaling * Pathing.distance(site.pos, dropoffLocation));
				}
			}
		}

		if (this.colony.lowPowerMode) {
			// Reduce needed transporters when colony is in low power mode
			transportPower *= 0.5;
		}

		// Add transport power needed to move to upgradeSite
		transportPower += this.colony.upgradeSite.upgradePowerNeeded * scaling *
						  Pathing.distance(dropoffLocation, (this.colony.upgradeSite.battery ||
															 this.colony.upgradeSite).pos);
		return transportPower / CARRY_CAPACITY;
	}

	init() {
		let setup = this.colony.stage == ColonyStage.Larva ? TransporterEarlySetup : TransporterSetup;
		let transportPowerEach = setup.getBodyPotential(CARRY, this.colony);
		let neededTransportPower = this.neededTransportPower();
		this.wishlist(Math.ceil(neededTransportPower / transportPowerEach), setup);
	}

	private handleTransporter(transporter: Zerg, request: LogisticsRequest | undefined) {
		if (request) {
			let choices = this.logisticsGroup.bufferChoices(transporter, request);
			let bestChoice = _.last(_.sortBy(choices, choice => request.multiplier * choice.dQ
																/ Math.max(choice.dt, 0.1)));
			let task = null;
			let amount = this.logisticsGroup.predictedRequestAmount(transporter, request);
			// Target is requesting input
			if (amount > 0) {
				if (isResource(request.target) || isTombstone(request.target)) {
					log.warning(`Improper logistics request: should not request input for resource or tombstone!`);
					return;
				} else if (request.resourceType == 'all') {
					log.error(`TransportOverlord: ` + ALL_RESOURCE_TYPE_ERROR);
					return;
				} else {
					task = Tasks.transfer(request.target, request.resourceType);
				}
				if (bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to get more stuff
					let buffer = deref(bestChoice.targetRef) as BufferTarget;
					let withdrawAmount = Math.min(buffer.store[request.resourceType] || 0,
						transporter.carryCapacity - _.sum(transporter.carry), amount);
					task = task.fork(Tasks.withdraw(buffer, request.resourceType, withdrawAmount));
					if (transporter.hasMineralsInCarry && request.resourceType == RESOURCE_ENERGY) {
						task = task.fork(Tasks.transferAll(buffer));
					}
				}
			}
			// Target is requesting output
			else if (amount < 0) {
				if (isResource(request.target)) {
					task = Tasks.pickup(request.target);
				} else {
					if (request.resourceType == 'all') {
						if (!isStoreStructure(request.target) && !isTombstone(request.target)) {
							log.error(`TransportOverlord: ` + ALL_RESOURCE_TYPE_ERROR);
							return;
						}
						task = Tasks.withdrawAll(request.target);
					} else {
						task = Tasks.withdraw(request.target, request.resourceType);
					}
				}
				if (task && bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to deposit stuff
					let buffer = deref(bestChoice.targetRef) as BufferTarget;
					task = task.fork(Tasks.transferAll(buffer));
				}
			} else {
				// console.log(`${transporter.name} chooses a store with 0 amount!`);
				transporter.park();
			}
			// Assign the task to the transporter
			transporter.task = task;
			this.logisticsGroup.invalidateCache(transporter, request);
		} else {
			// If nothing to do, put everything in a store structure
			if (_.sum(transporter.carry) > 0) {
				let dropoffPoints: (StructureLink | StructureStorage)[] = _.compact([this.colony.storage!,
																					 ...this.colony.dropoffLinks]);
				// let bestDropoffPoint = minBy(dropoffPoints, function(dropoff: StructureLink | StructureStorage) {
				// 	let range = transporter.pos.getMultiRoomRangeTo(dropoff.pos);
				// 	if (dropoff instanceof StructureLink) {
				// 		return Math.max(range, this.colony.linkNetwork.getDropoffAvailability(dropoff));
				// 	} else {
				// 		return range;
				// 	}
				// });
				let nonzeroResources = _.filter(_.keys(transporter.carry),
												(key: ResourceConstant) => (transporter.carry[key] || 0) > 0);
				if (nonzeroResources.length > 1) {
					if (this.colony.storage) {
						transporter.task = Tasks.transferAll(this.colony.storage);
					}
				}
				else {
					let bestDropoffPoint = transporter.pos.findClosestByMultiRoomRange(dropoffPoints);

					if (bestDropoffPoint) transporter.task = Tasks.transfer(bestDropoffPoint);
				}
			} else {
				let parkingSpot = transporter.pos;
				if (this.colony.storage) {
					parkingSpot = this.colony.storage.pos;
				} else if (this.colony.roomPlanner.storagePos) {
					parkingSpot = this.colony.roomPlanner.storagePos;
				}
				transporter.park(parkingSpot);
			}
		}
		//console.log(JSON.stringify(transporter.memory.task));
	}

	private handleBigTransporter(bigTransporter: Zerg) {
		let bestRequestViaStableMatching = this.logisticsGroup.matching[bigTransporter.name];
		this.handleTransporter(bigTransporter, bestRequestViaStableMatching);
	}

	/* Handles small transporters, which don't do well with the logisticsNetwork's stable matching system */
	private handleSmolTransporter(smolTransporter: Zerg) {
		// Just perform a single-sided greedy selection of all requests
		let bestRequestViaGreedy = _.first(this.logisticsGroup.transporterPreferences(smolTransporter));
		this.handleTransporter(smolTransporter, bestRequestViaGreedy);
	}

	private pickupDroppedResources(transporter: Zerg) {
		let droppedResource = transporter.pos.lookFor(LOOK_RESOURCES)[0];
		if (droppedResource) {
			transporter.pickup(droppedResource);
			return;
		}
		let tombstone = transporter.pos.lookFor(LOOK_TOMBSTONES)[0];
		if (tombstone) {
			let resourceType = _.last(_.sortBy(_.keys(tombstone.store),
											   resourceType => (tombstone.store[<ResourceConstant>resourceType] || 0)));
			transporter.withdraw(tombstone, <ResourceConstant>resourceType);
		}
	}

	run() {
		for (let transporter of this.transporters) {
			if (transporter.isIdle) {
				// if (transporter.carryCapacity >= LogisticsNetwork.settings.carryThreshold) {
				// 	this.handleBigTransporter(transporter);
				// } else {
				// 	this.handleSmolTransporter(transporter);
				// }
				this.handleSmolTransporter(transporter);
			}
			transporter.run();
			// this.pickupDroppedResources(transporter);
		}
		// this.parkCreepsIfIdle(this.transporters);
	}
}
