import {Overlord} from './Overlord';
import {Priority} from '../config/priorities';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskDeposit} from '../tasks/task_deposit';
import {log} from '../lib/logger/log';
import {QueenSetup} from '../creepSetup/defaultSetups';
import {Hatchery} from '../hiveClusters/hiveCluster_hatchery';
import {EnergyRequestStructure, ResourceRequestStructure} from '../resourceRequests/TransportRequestGroup';
import {Zerg} from '../Zerg';

// Hatchery overlord: spawn and run a dedicated supplier-like hatchery attendant (called after colony has storage)
export class HatcheryOverlord extends Overlord {

	hatchery: Hatchery;
	queens: Zerg[];
	settings: any;

	// private _prioritizedRefills: { [priority: number]: IResourceRequest[] };

	constructor(hatchery: Hatchery, priority = Priority.High) {
		super(hatchery, 'hatchery', priority);
		this.hatchery = hatchery;
		this.queens = this.getCreeps('queen');
		this.settings = {
			refillTowersBelow: 500,
		};
	}

	spawn() {
		this.wishlist(1, new QueenSetup());
	}

	init() {
		this.spawn();
	}

	// private get prioritizedRefillRequests(): { [priority: number]: IResourceRequest[] } {
	// 	// Prioritized list of things that can be refilled
	// 	if (!this._prioritizedRefills) {
	// 		this._prioritizedRefills = blankPriorityQueue();
	//
	// 		for (let request of this.colony.transportRequests.supply) {
	// 			let priority: number;
	// 			if (request.target instanceof StructureSpawn) {
	// 				priority = Priority.Normal;
	// 			} else if (request.target instanceof StructureExtension) {
	// 				priority = Priority.Normal;
	// 			} else if (request.target instanceof StructureTower) {
	// 				if (request.target.energy < this.settings.refillTowersBelow) {
	// 					priority = Priority.High;
	// 				} else {
	// 					priority = Priority.Low;
	// 				}
	// 			} else {
	// 				priority = Priority.Normal;
	// 			}
	// 			// Push the request to the specified priority
	// 			this._prioritizedRefills[priority].push(request);
	// 		}
	// 	}
	// 	return this._prioritizedRefills;
	// }

	private supplyActions(queen: Zerg) {
		// Select the closest supply target out of the highest priority and refill it
		let target: EnergyRequestStructure | ResourceRequestStructure;
		for (let priority in this.hatchery.transportRequests.supply) {
			let targets = _.map(this.hatchery.transportRequests.supply[priority], request => request.target);
			target = queen.pos.findClosestByRange(targets);
			if (target) {
				queen.task = new TaskDeposit(target);
				return;
			}
		}
		// Otherwise, if there are no targets, refill yourself
		this.rechargeActions(queen);
	}

	private rechargeActions(queen: Zerg): void {
		if (this.hatchery.link && !this.hatchery.link.isEmpty) {
			queen.task = new TaskWithdraw(this.hatchery.link);
		} else if (this.hatchery.battery && !this.hatchery.battery.isEmpty) {
			queen.task = new TaskWithdraw(this.hatchery.battery);
		} else {
			log.info('Hatchery is out of energy!');
		}
	}

	private idleActions(queen: Zerg): void {
		if (this.hatchery.battery && this.hatchery.link) { // is there a battery and a link?
			// Can energy be moved from the link to the battery?
			if (!this.hatchery.battery.isFull && !this.hatchery.link.isEmpty) { 	// move energy to battery
				if (queen.carry.energy < queen.carryCapacity) {
					queen.task = new TaskWithdraw(this.hatchery.link);
				} else {
					queen.task = new TaskDeposit(this.hatchery.battery);
				}
			} else {
				if (queen.carry.energy < queen.carryCapacity) { // make sure you're recharged
					queen.task = new TaskWithdraw(this.hatchery.link);
				}
			}
		}
		if (queen.isIdle) {
			queen.travelTo(this.hatchery.idlePos);
		}
	}

	private handleQueen(queen: Zerg): void {
		if (queen.carry.energy > 0) {
			this.supplyActions(queen);
		} else {
			this.rechargeActions(queen);
		}
		// If there aren't any tasks that need to be done, recharge the battery from link
		if (queen.isIdle) {
			this.idleActions(queen);
		}
		// // If all of the above is done and hatchery is not in emergencyMode, move to the idle point and renew as needed
		// if (!this.emergencyMode && queen.isIdle) {
		// 	if (queen.pos.isEqualTo(this.idlePos)) {
		// 		// If queen is at idle position, renew her as needed
		// 		if (queen.ticksToLive < this.settings.renewQueenAt && this.availableSpawns.length > 0) {
		// 			this.availableSpawns[0].renewCreep(queen.creep);
		// 		}
		// 	} else {
		// 		// Otherwise, travel back to idle position
		// 		queen.travelTo(this.idlePos);
		// 	}
		// }
	}

	run() {
		for (let queen of this.queens) {
			this.handleQueen(queen);
		}
		// Delete extraneous queens in the case there are multiple
		if (this.queens.length > 1) {
			let queenToSuicide = _.first(_.sortBy(this.queens, queen => queen.ticksToLive));
			if (queenToSuicide) {
				queenToSuicide.suicide();
			}
		}
	}
}
