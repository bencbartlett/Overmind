import {Colony} from '../../Colony';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {isAnyZerg, isDirective, isResource, isRuin, isTombstone} from '../../declarations/typeGuards';
import {ALL_RESOURCE_TYPE_ERROR, BufferTarget, LogisticsRequest} from '../../logistics/LogisticsNetwork';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord, OverlordMemory} from '../Overlord';

export interface TransportOverlordMemory extends OverlordMemory {
	transporterSaturation: number;
}

const getDefaultTransportOverlordMemory: () => TransportOverlordMemory = () => ({
	transporterSaturation: .1,
});

/**
 * The transport overlord handles energy transport throughout a colony
 */
@profile
export class TransportOverlord extends Overlord {

	memory: TransportOverlordMemory;

	transporters: Zerg[];

	constructor(colony: Colony, priority = OverlordPriority.ownedRoom.transport) {
		super(colony, 'logistics', priority, getDefaultTransportOverlordMemory);
		this.transporters = this.zerg(Roles.transport);
	}

	/**
	 * Returns the total number of CARRY bodyparts needed to fully saturate all energy sources in the colony
	 */
	private neededTransportPower(): number {

		if (!this.colony.storage
			&& !(this.colony.hatchery && this.colony.hatchery.batteries.length > 0)
			&& !this.colony.upgradeSite.battery) {
			return 0;
		}

		let transportPower = 0;
		const scaling = 2; // this.colony.stage == ColonyStage.Larva ? 1.5 : 2.0; // aggregate round-trip multiplier

		// Add contributions to transport power from hauling energy from mining sites
		for (const flagName in this.colony.miningSites) {
			const miningOverlord = this.colony.miningSites[flagName].overlords.mine;
			if (!miningOverlord.isSuspended && miningOverlord.miners.length > 0) {
				// Only count sites which have a container output and which have at least one miner present
				// (this helps in difficult "rebooting" situations)
				if ((miningOverlord.container && !miningOverlord.link) || miningOverlord.allowDropMining) {
					transportPower += miningOverlord.energyPerTick * scaling * miningOverlord.distance;
				}
			}
		}

		// Add transport power needed to move to upgradeSite
		if (this.colony.upgradeSite.battery) {
			transportPower += UPGRADE_CONTROLLER_POWER * this.colony.upgradeSite.upgradePowerNeeded * scaling *
							  (Pathing.distance(this.colony.pos, this.colony.upgradeSite.battery.pos) || 0);
		}


		if (this.colony.state.lowPowerMode) {
			// Reduce needed transporters when colony is in low power mode
			transportPower *= 0.5;
		}

		return transportPower / CARRY_CAPACITY;
	}

	init() {
		const ROAD_COVERAGE_THRESHOLD = 0.75; // switch from 1:1 to 2:1 transporters above this coverage threshold
		const setup = this.colony.roomPlanner.roadPlanner.roadCoverage < ROAD_COVERAGE_THRESHOLD
					  ? Setups.transporters.early : Setups.transporters.default;

		const transportPowerEach = setup.getBodyPotential(CARRY, this.colony);
		const neededTransportPower = this.neededTransportPower();

		const currentTransportPower = _.sum(this.transporters, t => t.bodypartCounts[CARRY]);
		this.memory.transporterSaturation = currentTransportPower / neededTransportPower;

		const numTransporters = Math.ceil(1.2 * neededTransportPower / transportPowerEach + 0.1); // div by zero error

		if (this.transporters.length == 0) {
			this.wishlist(numTransporters, setup, {priority: OverlordPriority.ownedRoom.firstTransport});
		} else {
			this.wishlist(numTransporters, setup);
		}
	}

	private handleTransporter(transporter: Zerg, request: LogisticsRequest | undefined) {
		if (request) {
			const choices = this.colony.logisticsNetwork.bufferChoices(transporter, request);
			const bestChoice = _.last(_.sortBy(choices, choice => request.multiplier * choice.dQ
																  / Math.max(choice.dt, 0.5)));
			let task = null;
			const amount = this.colony.logisticsNetwork.predictedRequestAmount(transporter, request);
			// Target is requesting input
			if (amount > 0) {
				if (isResource(request.target) || isTombstone(request.target) || isRuin(request.target)) {
					log.warning(`Improper logistics request: should not request input for resource or tombstone or ruin!`);
					return;
				} else if (request.resourceType == 'all') {
					log.error(`${this.print}: cannot request 'all' as input!`);
					return;
				} else if (isDirective(request.target)) {
					task = Tasks.drop(request.target, request.resourceType);
				} else if (isAnyZerg(request.target)) {
					task = Tasks.transfer(request.target.creep, request.resourceType);
				} else {
					task = Tasks.transfer(request.target, request.resourceType);
				}
				if (bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to get more stuff
					const buffer = deref(bestChoice.targetRef) as BufferTarget;
					const withdrawAmount = Math.min(buffer.store[request.resourceType] || 0,
													transporter.store.getFreeCapacity(request.resourceType), amount);
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
					if (isDirective(request.target)) {
						log.error(`Directive ${request.target} cannot be used for output request`);
					} else if (isAnyZerg(request.target)) {
						log.error(`Zerg ${request.target} cannot be used for output request (WIP, maybe future)`);
					} else {
						if (request.resourceType == 'all') {
							if (isResource(request.target)) {
								log.error(this.print + ALL_RESOURCE_TYPE_ERROR);
								return;
							}
							task = Tasks.withdrawAll(request.target);
						} else {
							task = Tasks.withdraw(request.target, request.resourceType);
						}
					}
				}
				if (task && bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to deposit stuff
					const buffer = deref(bestChoice.targetRef) as BufferTarget;
					task = task.fork(Tasks.transferAll(buffer));
				}
			} else {
				// console.log(`${transporter.name} chooses a store with 0 amount!`);
				transporter.park();
			}
			// Assign the task to the transporter
			transporter.task = task;
			this.colony.logisticsNetwork.invalidateCache(transporter, request);
		} else {
			// If nothing to do, put everything in a store structure
			if (transporter.store.getUsedCapacity() > 0) {
				if (transporter.hasMineralsInCarry) {
					const target = this.colony.terminal || this.colony.storage;
					if (target) {
						transporter.task = Tasks.transferAll(target);
					}
				} else {
					const dropoffPoints: (StructureLink | StructureStorage)[] = _.compact([this.colony.storage!]);
					// , ...this.colony.dropoffLinks]);

					// let bestDropoffPoint = minBy(dropoffPoints, function(dropoff: StructureLink | StructureStorage) {
					// 	let range = transporter.pos.getMultiRoomRangeTo(dropoff.pos);
					// 	if (dropoff instanceof StructureLink) {
					// 		return Math.max(range, this.colony.linkNetwork.getDropoffAvailability(dropoff));
					// 	} else {
					// 		return range;
					// 	}
					// });

					const bestDropoffPoint = transporter.pos.findClosestByMultiRoomRange(dropoffPoints);

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
		// console.log(JSON.stringify(transporter.memory.task));
	}

	private handleBigTransporter(bigTransporter: Zerg) {
		const bestRequestViaStableMatching = this.colony.logisticsNetwork.matching[bigTransporter.name];
		this.handleTransporter(bigTransporter, bestRequestViaStableMatching);
	}

	/* Handles small transporters, which don't do well with the logisticsNetwork's stable matching system */
	private handleSmolTransporter(smolTransporter: Zerg) {
		// Just perform a single-sided greedy selection of all requests
		const bestRequestViaGreedy = _.first(this.colony.logisticsNetwork.transporterPreferences(smolTransporter));
		this.handleTransporter(smolTransporter, bestRequestViaGreedy);
	}

	private pickupDroppedResources(transporter: Zerg) {
		const droppedResource = transporter.pos.lookFor(LOOK_RESOURCES)[0];
		if (droppedResource) {
			transporter.pickup(droppedResource);
			return;
		}
		const tombstone = transporter.pos.lookFor(LOOK_TOMBSTONES)[0];
		if (tombstone) {
			const resourceType = _.last(_.sortBy(_.keys(tombstone.store),
												 resourceType => (tombstone.store[<ResourceConstant>resourceType] || 0)));
			transporter.withdraw(tombstone, <ResourceConstant>resourceType);
		}
	}

	run() {
		this.autoRun(this.transporters, transporter => this.handleSmolTransporter(transporter));
	}
}
