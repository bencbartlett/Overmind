import {Overlord} from './Overlord';
import {Priority} from '../config/priorities';
import {QueenSetup} from '../creepSetup/defaultSetups';
import {Hatchery} from '../hiveClusters/hiveCluster_hatchery';
import {EnergyRequestStructure, ResourceRequestStructure} from '../resourceRequests/TransportRequestGroup';
import {Zerg} from '../Zerg';
import {Tasks} from '../tasks/Tasks';

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

	private supplyActions(queen: Zerg) {
		// Select the closest supply target out of the highest priority and refill it
		let target: EnergyRequestStructure | ResourceRequestStructure;
		for (let priority in this.hatchery.transportRequests.supply) {
			let targets = _.map(this.hatchery.transportRequests.supply[priority], request => request.target);
			target = queen.pos.findClosestByRange(targets);
			if (target) {
				queen.task = Tasks.deposit(target);
				return;
			}
		}
		// Otherwise, if there are no targets, refill yourself
		this.rechargeActions(queen);
	}

	private rechargeActions(queen: Zerg): void {
		if (this.hatchery.link && !this.hatchery.link.isEmpty) {
			queen.task = Tasks.withdraw(this.hatchery.link);
		} else if (this.hatchery.battery && !this.hatchery.battery.isEmpty) {
			queen.task = Tasks.withdraw(this.hatchery.battery);
		}
	}

	private idleActions(queen: Zerg): void {
		if (this.hatchery.battery) { // is there a battery and a link?
			if (this.hatchery.battery.hits < this.hatchery.battery.hitsMax) {
				queen.task = Tasks.repair(this.hatchery.battery);
			} else if (this.hatchery.link) {
				// Can energy be moved from the link to the battery?
				if (!this.hatchery.battery.isFull && !this.hatchery.link.isEmpty) { 	// move energy to battery
					if (queen.carry.energy < queen.carryCapacity) {
						queen.task = Tasks.withdraw(this.hatchery.link);
					} else {
						queen.task = Tasks.deposit(this.hatchery.battery);
					}
				} else {
					if (queen.carry.energy < queen.carryCapacity) { // make sure you're recharged
						queen.task = Tasks.withdraw(this.hatchery.link);
					}
				}
			}
		}
		// If you're still idle, move back to the idle point
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
