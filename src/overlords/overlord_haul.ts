import {Overlord} from './Overlord';
import {HaulerSetup} from '../creepSetup/defaultSetups';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskGoTo} from '../tasks/task_goTo';
import {TaskDeposit} from '../tasks/task_deposit';
import {Priority} from '../config/priorities';


export class HaulingOverlord extends Overlord {
	haulers: Zerg[];
	miningGroup: IMiningGroup;

	constructor(miningGroup: IMiningGroup, priority = Priority.Normal) {
		super(miningGroup, 'haul', priority);
		this.haulers = this.getCreeps('hauler');
		this.miningGroup = miningGroup;
	}

	spawn() {
		let haulingPower = _.sum(_.map(this.lifetimeFilter(this.haulers), creep => creep.getActiveBodyparts(CARRY)));
		if (haulingPower < this.miningGroup.data.haulingPowerNeeded) {
			this.requestCreep(new HaulerSetup());
		}
	}

	init() {
		this.spawn();
	}

	// Gets a prioritized request if any
	private getWithdrawRequest(): IWithdrawRequest | undefined {
		for (let priority in this.miningGroup.transportRequests.withdraw) {
			let request = this.miningGroup.transportRequests.withdraw[priority][0];
			if (request) return request;
		}
	}

	private handleHauler(hauler: Zerg) {
		if (hauler.carry.energy == 0) {
			// Withdraw from any miningSites requesting a withdrawal
			let request = this.getWithdrawRequest();
			if (request) {
				hauler.task = new TaskWithdraw(request.target);
			} else {
				// hauler.park(); // TODO
			}
		} else {
			// If you're near the dropoff point, deposit, else go back to the dropoff point
			if (hauler.pos.inRangeTo(this.miningGroup.dropoff.pos, 3)) {
				if (this.miningGroup.availableLinks && this.miningGroup.availableLinks[0]) {
					hauler.task = new TaskDeposit(this.miningGroup.availableLinks[0]);
				} else {
					hauler.task = new TaskDeposit(this.miningGroup.dropoff);
				}
			} else {
				hauler.task = new TaskGoTo(this.miningGroup.dropoff);
			}
		}
	}

	run() {
		for (let hauler of this.haulers) {
			if (hauler.isIdle) {
				this.handleHauler(hauler);
			}
		}
	}

}