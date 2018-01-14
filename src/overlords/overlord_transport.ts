// import {Overlord} from './Overlord';
// import {Priority} from '../config/priorities';
// import {Zerg} from '../Zerg';
// import {HaulerSetup} from '../creepSetup/defaultSetups';
// import {MiningGroup} from '../hiveClusters/hiveCluster_miningGroup';
// import {IWithdrawRequest} from '../resourceRequests/TransportRequestGroup';
// import {Tasks} from '../tasks/Tasks';
// import {TaskDeposit} from '../tasks/task_deposit';
// import {TaskWithdraw} from '../tasks/task_withdraw';
//
// export class TransportOverlord extends Overlord {
//
// 	transporters: Zerg[];
// 	miningGroup: MiningGroup;
//
// 	constructor(miningGroup: MiningGroup, priority = Priority.NormalLow) {
// 		super(miningGroup, 'transport', priority);
// 		this.transporters = this.creeps('transporter');
// 		this.miningGroup = miningGroup;
// 	}
//
// 	spawn() {
// 		let haulingPower = _.sum(_.map(this.lifetimeFilter(this.transporters), creep => creep.getActiveBodyparts(CARRY)));
// 		if (haulingPower < this.miningGroup.data.haulingPowerNeeded) {
// 			this.requestCreep(new HaulerSetup());
// 		}
// 	}
//
// 	init() {
// 		this.spawn();
// 	}
//
// 	private supplyActions(supplier: Zerg) {
// 		// Select the closest supply target out of the highest priority and refill it
// 		for (let priority in this.colony.transportRequests.supply) {
// 			let targets = _.map(this.colony.transportRequests.supply[priority], request => request.target);
// 			let target = supplier.pos.findClosestByRange(targets);
// 			if (target) {
// 				supplier.task = new TaskDeposit(target);
// 				return;
// 			}
// 		}
// 		// Otherwise, if there are no targets, refill yourself
// 		this.rechargeActions(supplier);
// 	}
//
// 	private rechargeActions(supplier: Zerg) {
// 		// Select the closest target of highest priority requesting a withdrawal
// 		for (let priority in this.colony.transportRequests.withdraw) {
// 			let targets = _.map(this.colony.transportRequests.withdraw[priority], request => request.target);
// 			let target = supplier.pos.findClosestByRange(targets);
// 			if (target) {
// 				supplier.task = new TaskWithdraw(target);
// 				return;
// 			}
// 		}
// 		// Otherwise, if nothing actively wants a withdraw, refill from nearest storage or mining container
// 		let viableTargets: StorageUnit[] = [];
// 		if (this.room.storage && this.room.storage.energy > supplier.carryCapacity) {
// 			viableTargets.push(this.room.storage);
// 		}
// 		for (let source of this.room.sources) {
// 			let output = this.colony.miningSites[source.id].output;
// 			if (output instanceof StructureContainer && output.energy > supplier.carryCapacity) {
// 				viableTargets.push(output);
// 			}
// 		}
// 		let target = supplier.pos.findClosestByRange(viableTargets);
// 		if (target) {
// 			supplier.task = new TaskWithdraw(target);
// 		}
// 	}
//
// 	// Gets a prioritized request if any
// 	private getWithdrawRequest(): IWithdrawRequest | undefined {
// 		for (let priority in this.miningGroup.transportRequests.withdraw) {
// 			// Shift the first request from the group to prevent all idle haulers from targeting at once
// 			let request = this.miningGroup.transportRequests.withdraw[priority].shift();
// 			if (request) return request;
// 		}
// 	}
//
// 	private handleHauler(hauler: Zerg) {
// 		if (hauler.carry.energy == 0) {
// 			// Withdraw from any miningSites requesting a withdrawal
// 			let request = this.getWithdrawRequest();
// 			if (request) {
// 				hauler.task = Tasks.withdraw(request.target);
// 			} else {
// 				// hauler.park(); // TODO
// 			}
// 		} else {
// 			// If you're near the dropoff point, deposit, else go back to the dropoff point
// 			if (hauler.pos.inRangeTo(this.miningGroup.dropoff.pos, 3)) {
// 				if (this.miningGroup.availableLinks && this.miningGroup.availableLinks[0]) {
// 					hauler.task = Tasks.deposit(this.miningGroup.availableLinks[0]);
// 				} else {
// 					hauler.task = Tasks.deposit(this.miningGroup.dropoff);
// 				}
// 			} else {
// 				hauler.task = Tasks.goTo(this.miningGroup.dropoff);
// 			}
// 		}
// 	}
//
// 	run() {
// 		for (let hauler of this.transporters) {
// 			if (hauler.isIdle) {
// 				this.handleHauler(hauler);
// 			}
// 		}
// 	}
//
// }