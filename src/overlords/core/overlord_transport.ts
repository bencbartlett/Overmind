import {Overlord} from '../Overlord';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Colony, ColonyStage} from '../../Colony';
import {BufferTarget, LogisticsGroup, LogisticsRequest} from '../../logistics/LogisticsGroup';
import {TransporterEarlySetup, TransporterSetup} from '../../creepSetup/defaultSetups';
import {OverlordPriority} from '../priorities_overlords';
import {Pathing} from '../../pathing/pathing';
import {DirectiveLogisticsRequest} from '../../directives/logistics/directive_logisticsRequest';
import {profile} from '../../profiler/decorator';

@profile
export class TransportOverlord extends Overlord {

	transporters: Zerg[];
	logisticsGroup: LogisticsGroup;

	constructor(colony: Colony, priority = colony.getCreepsByRole(TransporterSetup.role).length > 0 ?
										   OverlordPriority.ownedRoom.transport : OverlordPriority.ownedRoom.firstTransport) {
		super(colony, 'logistics', priority);
		this.transporters = this.creeps(TransporterSetup.role);
		this.logisticsGroup = colony.logisticsGroup;
	}

	private neededTransportPower(): number {
		let transportPower = 0;
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
			if (site.output instanceof StructureContainer && site.overlord.miners.length > 0) {
				// Only count sites which have a container output and which have at least one miner present
				// (this helps in difficult "rebooting" situations)
				let scaling = 1.75; // Average distance you have to carry resources
				transportPower += site.energyPerTick * (scaling * Pathing.distance(site.pos, dropoffLocation));
			}
		}
		if (this.colony.lowPowerMode) {
			// Reduce needed transporters when colony is in low power mode
			transportPower *= 0.5;
		}
		return transportPower / CARRY_CAPACITY;
	}

	init() {
		let setup = this.colony.stage == ColonyStage.Larva ? new TransporterEarlySetup() : new TransporterSetup();
		let transportPower = _.sum(_.map(this.lifetimeFilter(this.transporters),
										 creep => creep.getActiveBodyparts(CARRY)));
		let neededTransportPower = this.neededTransportPower();
		if (transportPower < neededTransportPower) {
			this.requestCreep(setup);
		}
		this.creepReport(setup.role, transportPower, neededTransportPower);
	}

	private handleTransporter(transporter: Zerg, request: LogisticsRequest | undefined) {
		if (request) {
			let choices = this.logisticsGroup.bufferChoices(transporter, request);
			let bestChoice = _.last(_.sortBy(choices, choice => choice.deltaResource / choice.deltaTicks));
			let task = null;
			let amount = this.logisticsGroup.predictedAmount(transporter, request);
			if (amount > 0) { // store needs refilling
				if (request.target instanceof DirectiveLogisticsRequest) {
					task = Tasks.drop(request.target);
				} else {
					task = Tasks.transfer(request.target);
				}
				if (bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to get more stuff
					let buffer = deref(bestChoice.targetRef) as BufferTarget;
					let withdrawAmount = Math.min(buffer.store[request.resourceType] || 0, amount);
					task = task.fork(Tasks.withdraw(buffer, request.resourceType, amount));
				}
			} else if (amount < 0) { // store needs withdrawal
				if (request.target instanceof DirectiveLogisticsRequest) {
					let drops = request.target.drops[request.resourceType] || [];
					let resource = drops[0];
					if (resource) {
						task = Tasks.pickup(resource);
					}
				} else {
					task = Tasks.withdraw(request.target);
				}
				if (task && bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to deposit stuff
					let buffer = deref(bestChoice.targetRef) as BufferTarget | StructureLink;
					task = task.fork(Tasks.transfer(buffer, request.resourceType));
				}
			} else {
				// console.log(`${transporter.name} chooses a store with 0 amount!`);
				transporter.park();
			}
			// Assign the task to the transporter
			transporter.task = task;
		} else {
			if (transporter.carry.energy > 0) {
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
				let bestDropoffPoint = transporter.pos.findClosestByMultiRoomRange(dropoffPoints);
				if (bestDropoffPoint) transporter.task = Tasks.transfer(bestDropoffPoint);
			} else {
				let parkingSpot = this.colony.storage ? this.colony.storage.pos : transporter.pos;
				transporter.park(parkingSpot);
			}
		}
	}

	private handleBigTransporter(bigTransporter: Zerg) {
		let bestRequestViaStableMatching = this.logisticsGroup.matching[bigTransporter.name];
		this.handleTransporter(bigTransporter, bestRequestViaStableMatching);
	}

	/* Handles small transporters, which don't do well with the logisticsGroup's stable matching system */
	private handleSmolTransporter(smolTransporter: Zerg) {
		// Just perform a single-sided greedy selection of all requests
		let bestRequestViaGreedy = _.first(this.logisticsGroup.transporterPreferences(smolTransporter));
		this.handleTransporter(smolTransporter, bestRequestViaGreedy);
	}

	run() {
		for (let transporter of this.transporters) {
			if (transporter.isIdle) {
				if (transporter.carryCapacity >= LogisticsGroup.settings.carryThreshold) {
					this.handleBigTransporter(transporter);
				} else {
					this.handleSmolTransporter(transporter);
				}
			}
		}
	}
}
