import {Overlord} from './Overlord';
import {SupplierSetup} from '../creepSetup/defaultSetups';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskDeposit} from '../tasks/task_deposit';
import {blankPriorityQueue, Priority} from '../config/priorities';

// enum Priorities {
// 	High   = 1,
// 	Normal = 2,
// 	Low    = 3,
// }

// TODO: make this work with more resources than just energy
export class SupplierOverlord extends Overlord {

	suppliers: Zerg[];
	settings: any;
	room: Room; // Suppliers only work in owned rooms so there is definitely vision

	private _prioritizedRefills: { [priority: number]: IResourceRequest[] };
	private _prioritizedWithdrawals: { [priority: number]: IWithdrawRequest[] };

	constructor(directive: IColony | IHiveCluster, priority = Priority.Normal) {
		super(directive, 'supply', priority);
		this.suppliers = this.getCreeps('supplier');
		this.settings = {
			refillTowersBelow: 500,
		};
	}

	spawn() {
		this.wishlist(1, new SupplierSetup(4));
	}

	init() {
		this.spawn();
	}

	private get prioritizedRefillRequests(): { [priority: number]: IResourceRequest[] } {
		// Prioritized list of things that can be refilled
		if (!this._prioritizedRefills) {
			this._prioritizedRefills = blankPriorityQueue();

			for (let request of this.colony.transportRequests.supply) {
				let priority: number;
				if (request.target instanceof StructureSpawn) {
					priority = Priority.Normal;
				} else if (request.target instanceof StructureExtension) {
					priority = Priority.Normal;
				} else if (request.target instanceof StructureTower) {
					if (request.target.energy < this.settings.refillTowersBelow) {
						priority = Priority.High;
					} else {
						priority = Priority.Low;
					}
				} else if (request.target instanceof StructureNuker) {
					priority = Priority.Low;
				} else {
					priority = Priority.Normal;
				}
				// Push the request to the specified priority
				this._prioritizedRefills[priority].push(request);
			}
		}
		return this._prioritizedRefills;
	}

	private get prioritizedWithdrawalRequests(): { [priority: number]: IWithdrawRequest[] } {
		// Prioritized list of things that need withdrawals
		if (!this._prioritizedWithdrawals) {
			this._prioritizedWithdrawals = {};
			this._prioritizedWithdrawals[Priority.High] = [];
			this._prioritizedWithdrawals[Priority.Normal] = [];
			this._prioritizedWithdrawals[Priority.Low] = [];

			for (let request of this.colony.transportRequests.withdraw) {
				let priority = Priority.Normal;
				// Push the request to the specified priority
				this._prioritizedWithdrawals[priority].push(request);
			}
		}
		return this._prioritizedWithdrawals;
	}

	private supplyActions(supplier: Zerg) {
		// Select the closest supply target out of the highest priority and refill it
		let target: EnergyRequestStructure | ResourceRequestStructure;
		for (let priority in this.prioritizedRefillRequests) {
			let targets = _.map(this.prioritizedRefillRequests[priority], request => request.target);
			target = supplier.pos.findClosestByRange(targets);
			if (target) {
				supplier.task = new TaskDeposit(target);
				return;
			}
		}
		// Otherwise, if there are no targets, refill yourself
		this.rechargeActions(supplier);
	}

	private rechargeActions(supplier: Zerg) {
		// Select the closest target of highest priority requesting a withdrawal
		let target: EnergyWithdrawStructure | ResourceWithdrawStructure | StructureStorage;
		for (let priority in this.prioritizedWithdrawalRequests) {
			let targets = _.map(this.prioritizedWithdrawalRequests[priority], request => request.target);
			target = supplier.pos.findClosestByRange(targets);
			if (target) {
				supplier.task = new TaskWithdraw(target);
				return;
			}
		}
		// Otherwise, if nothing actively wants a withdraw, refill from nearest storage or mining container
		let viableTargets: StorageUnit[] = [];
		if (this.room.storage) viableTargets.push(this.room.storage);
		for (let source of this.room.sources) {
			let output = this.colony.miningSites[source.id].output;
			if (output instanceof StructureContainer && output.energy > supplier.carryCapacity) {
				viableTargets.push(output);
			}
		}
		target = supplier.pos.findClosestByRange(viableTargets);
		if (target) {
			supplier.task = new TaskWithdraw(target);
		}
	}

	private handleSupplier(supplier: Zerg) {
		if (supplier.carry.energy > 0) {
			this.supplyActions(supplier);
		} else {
			this.rechargeActions(supplier);
		}
	}

	run() {
		for (let supplier of this.suppliers) {
			if (supplier.isIdle) {
				this.handleSupplier(supplier);
			}
			supplier.run();
		}
	}
}
