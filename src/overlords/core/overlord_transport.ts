import {Overlord} from '../Overlord';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Colony} from '../../Colony';
import {BufferTarget, LogisticsGroup} from '../../logistics/LogisticsGroup';
import {TransporterSetup} from '../../creepSetup/defaultSetups';
import {OverlordPriority} from '../priorities_overlords';
import {Pathing} from '../../pathing/pathing';
import {DirectiveLogisticsRequest} from '../../directives/logistics/directive_logisticsRequest';
import {profile} from '../../profiler/decorator';

@profile
export class TransportOverlord extends Overlord {

	transporters: Zerg[];
	logisticsGroup: LogisticsGroup;

	constructor(colony: Colony, priority = colony.getCreepsByRole(TransporterSetup.role).length > 0 ?
										   OverlordPriority.ownedRoom.haul : OverlordPriority.ownedRoom.supply) {
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
		return transportPower / CARRY_CAPACITY;
	}

	init() {
		let transportPower = _.sum(_.map(this.lifetimeFilter(this.transporters),
										 creep => creep.getActiveBodyparts(CARRY)));
		let neededTransportPower = this.neededTransportPower();
		if (transportPower < neededTransportPower) {
			this.requestCreep(new TransporterSetup());
		}
		this.creepReport(TransporterSetup.role, transportPower, neededTransportPower);
	}


	private handleTransporter(transporter: Zerg) {
		let request = this.logisticsGroup.matching[transporter.name];
		if (request) {
			let choices = this.logisticsGroup.bufferChoices(transporter, request);
			let bestChoice = _.last(_.sortBy(choices, choice => choice.deltaResource / choice.deltaTicks));
			// console.log(`${transporter.name}: bestChoice: deltaResource: ${bestChoice.deltaResource}, deltaTicks: ${bestChoice.deltaTicks}`);
			let task = null;
			let amount = this.logisticsGroup.predictedAmount(transporter, request);
			if (amount > 0) { // request needs refilling
				if (request.target instanceof DirectiveLogisticsRequest) {
					task = Tasks.drop(request.target);
				} else {
					task = Tasks.deposit(request.target);
				}
				if (bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to get more stuff
					let buffer = deref(bestChoice.targetRef) as BufferTarget;
					task = task.fork(Tasks.withdraw(buffer));
				}
			} else if (amount < 0) { // request needs withdrawal
				if (request.target instanceof DirectiveLogisticsRequest) {
					let drops = request.target.drops[request.resourceType] || [];
					let resource = drops[0];
					if (!resource) return;
					task = Tasks.pickup(resource);
				} else {
					task = Tasks.withdraw(request.target);
				}
				if (bestChoice.targetRef != request.target.ref) {
					// If we need to go to a buffer first to deposit stuff
					let buffer = deref(bestChoice.targetRef) as BufferTarget | StructureLink;
					task = task.fork(Tasks.deposit(buffer));
				}
			} else {
				console.log(`${transporter.name} chooses a request with 0 amount!`);
			}
			// if (task) {
			// 	console.log(`${transporter.name} task: ${task.name} target ${task.targetPos.print}, ` +
			// 				`parent: ${task.parent ? task.parent.name + 'target: ' + task.parent.targetPos.print : 'none'}`);
			// }
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
				if (bestDropoffPoint) transporter.task = Tasks.deposit(bestDropoffPoint);
			} else {
				let parkingSpot = this.colony.storage ? this.colony.storage.pos : transporter.pos;
				transporter.park(parkingSpot);
			}
		}
	}

	// private transferMinerals(transporter: Zerg) {
	// 	let carry = transporter.carry as { [resource: string]: number };
	// 	for (let resource in carry) {
	// 		if (resource != RESOURCE_ENERGY && carry[resource] > 0) {
	// 			let target = this.getRequester(transporter, resource) || this.colony.terminal;
	// 			if (target) {
	// 				transporter.task = Tasks.transfer(target, <ResourceConstant>resource);
	// 			} else {
	// 				console.log(`${transporter.name}: no place to put ${resource}!`);
	// 			}
	// 		}
	// 	}
	// }
	//
	// private transporterIsTargeting(target: LogisticsTarget): boolean {
	// 	let targetingZerg = _.map(target.targetedBy, name => Game.zerg[name]);
	// 	let targetingTransporters = _.filter(targetingZerg, zerg => zerg.roleName == TransporterSetup.role);
	// 	return targetingTransporters.length > 0;
	// }
	//
	// private getActiveProvder(transporter: Zerg, resourceType: string = RESOURCE_ENERGY): LogisticsTarget | undefined {
	// 	let items = _.filter(this.colony.logisticsNetwork.activeProviders, item => item.resourceType == resourceType);
	// 	let targets = _.filter(_.map(items, item => item.target), target => !this.transporterIsTargeting(target));
	// 	return transporter.pos.findClosestByMultiRoomRange(targets);
	// }
	//
	// private getPassiveProvider(transporter: Zerg, resourceType: string = RESOURCE_ENERGY): LogisticsTarget | undefined {
	// 	let items = _.filter(this.colony.logisticsNetwork.passiveProviders, item => item.resourceType == resourceType);
	// 	let targets = _.filter(_.map(items, item => item.target), target => !this.transporterIsTargeting(target));
	// 	return transporter.pos.findClosestByMultiRoomRange(targets);
	// }
	//
	// private getRequester(transporter: Zerg, resourceType: string = RESOURCE_ENERGY): LogisticsTarget | undefined {
	// 	let items = _.filter(this.colony.logisticsNetwork.requesters, item => item.resourceType == resourceType);
	// 	let targets = _.filter(_.map(items, item => item.target), target => !this.transporterIsTargeting(target));
	// 	return transporter.pos.findClosestByMultiRoomRange(targets);
	// }
	//
	// private closestEnergyDropoff(transporter: Zerg): StructureLink | StoreStructure | undefined {
	// 	let freeLinks = _.filter(this.colony.logisticsNetwork.links,
	// 							 link => link.cooldown < transporter.pos.getRangeTo(link) &&
	// 									 link.energy == 0 &&
	// 									 !this.transporterIsTargeting(link));
	// 	let targets = [...freeLinks, ...this.logisticsGroup.buffers];
	// 	return transporter.pos.findClosestByMultiRoomRange(targets);
	// }
	//
	// private getWithdrawTarget(transporter: Zerg, request: LogisticsItem) {
	// 	let applicableBuffers = _.filter(this.colony.logisticsNetwork.buffers,
	// 									 buffer => (buffer.store[request.resourceType] || 0) >= request.amount);
	// 	return transporter.pos.findClosestByMultiRoomRange(applicableBuffers);
	// }
	//
	//
	// private handleTransporter(transporter: Zerg) {
	// 	if (_.sum(transporter.carry) == 0) {
	// 		let unhandledRequests = _.filter(this.colony.logisticsNetwork.requesters,
	// 										 item => !this.transporterIsTargeting(item.target));
	// 		let closestRequest = transporter.pos.findClosestByMultiRoomRange(unhandledRequests);
	// 		if (closestRequest) {
	// 			let amount = Math.min(transporter.carryCapacity, closestRequest.amount);
	// 			let withdrawTarget = this.getWithdrawTarget(transporter, closestRequest);
	// 			if (withdrawTarget) {
	// 				let task: Task = Tasks.transfer(closestRequest.target, closestRequest.resourceType, amount)
	// 									  .fork(Tasks.withdrawResource(withdrawTarget, closestRequest.resourceType,
	// 																   amount));
	// 				transporter.task = task;
	// 				return;
	// 			}
	// 		}
	// 		let provideItems = _.filter(this.colony.logisticsNetwork.activeProviders,
	// 									item => !this.transporterIsTargeting(item.target));
	// 		let closestItem = transporter.pos.findClosestByMultiRoomRange(provideItems);
	// 		if (closestItem) {
	// 			transporter.task = Tasks.withdrawResource(closestItem.target, closestItem.resourceType);
	// 		} else {
	// 			transporter.park();
	// 		}
	// 	} else {
	// 		if (transporter.inSameRoomAs(this.colony)) {
	// 			if (_.sum(transporter.carry) > transporter.carry.energy) {
	// 				// If transporter has minerals, get rid of them first
	// 				this.transferMinerals(transporter);
	// 			} else {
	// 				// Handle energy requests
	// 				let target = this.getRequester(transporter) || this.closestEnergyDropoff(transporter);
	// 				if (target) {
	// 					transporter.task = Tasks.deposit(target);
	// 				}
	// 			}
	// 		} else {
	// 			transporter.task = Tasks.goToRoom(this.colony.room.name);
	// 		}
	// 	}
	// }

	run() {
		for (let transporter of this.transporters) {
			// this.handleTransporterOld(transporter);
			if (transporter.isIdle) {
				this.handleTransporter(transporter);
			}
		}
	}

}