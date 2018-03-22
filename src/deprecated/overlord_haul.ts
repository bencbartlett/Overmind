// import {Overlord} from '../overlords/Overlord';
// import {HaulerSetup} from '../creepSetup/defaultSetups';
// import {Zerg} from '../Zerg';
// import {Tasks} from '../tasks/Tasks';
// import {IWithdrawRequest} from '../logistics/TransportRequestGroup';
// import {OverlordPriority} from '../overlords/priorities_overlords';
//
//
// export class HaulingOverlord extends Overlord {
//
// 	haulers: Zerg[];
// 	miningGroup: MiningGroup;
//
// 	constructor(miningGroup: MiningGroup, priority = OverlordPriority.ownedRoom.haul) {
// 		super(miningGroup, 'haul', priority);
// 		this.haulers = this.creeps('hauler');
// 		this.miningGroup = miningGroup;
// 	}
//
// 	init() {
// 		let haulingPower = _.sum(_.map(this.lifetimeFilter(this.haulers), creep => creep.getActiveBodyparts(CARRY)));
// 		if (haulingPower < this.miningGroup.data.haulingPowerNeeded) {
// 			this.requestCreep(new HaulerSetup());
// 		}
// 		this.creepReport(HaulerSetup.role, haulingPower, this.miningGroup.data.haulingPowerNeeded);
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
// 				if (request.target instanceof Resource) {
// 					hauler.task = Tasks.pickup(request.target);
// 				} else {
// 					hauler.task = Tasks.withdraw(request.target);
// 				}
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
// 		for (let hauler of this.haulers) {
// 			if (hauler.isIdle) {
// 				this.handleHauler(hauler);
// 			}
// 		}
// 	}
//
// }