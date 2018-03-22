// import {Overlord} from '../overlords/Overlord';
// import {SupplierSetup} from '../creepSetup/defaultSetups';
// import {Colony} from '../Colony';
// import {HiveCluster} from '../hiveClusters/HiveCluster';
// import {IResourceRequest, IWithdrawRequest} from '../logistics/TransportRequestGroup';
// import {Zerg} from '../Zerg';
// import {Tasks} from '../tasks/Tasks';
// import {OverlordPriority} from '../overlords/priorities_overlords';
//
//
// // TODO: make this work with more resources than just energy
// export class SupplierOverlord extends Overlord {
//
// 	suppliers: Zerg[];
// 	settings: any;
// 	room: Room; // Suppliers only work in owned rooms so there is definitely vision
//
// 	private _prioritizedRefills: { [priority: number]: IResourceRequest[] };
// 	private _prioritizedWithdrawals: { [priority: number]: IWithdrawRequest[] };
//
// 	constructor(colony: Colony | HiveCluster, priority = OverlordPriority.ownedRoom.supply) {
// 		super(colony, 'supply', priority);
// 		this.suppliers = this.creeps('supplier');
// 		this.settings = {
// 			refillTowersBelow: 500,
// 		};
// 	}
//
// 	init() {
// 		let numSuppliers = 1;
// 		if (2 <= this.room.controller!.level && this.room.controller!.level <= 3) numSuppliers = 2;
// 		this.wishlist(numSuppliers, new SupplierSetup(Infinity)); // TODO: scale suppliers better
// 	}
//
// 	private supplyActions(supplier: Zerg) {
// 		// Select the closest supply target out of the highest priority and refill it
// 		for (let priority in this.colony.transportRequests.supply) {
// 			let targets = _.map(this.colony.transportRequests.supply[priority], request => request.target);
// 			let target = supplier.pos.findClosestByRange(targets);
// 			if (target) {
// 				supplier.task = Tasks.deposit(target);
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
// 				if (target instanceof Resource) {
// 					supplier.task = Tasks.pickup(target);
// 				} else {
// 					supplier.task = Tasks.withdraw(target);
// 				}
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
// 			if (output instanceof StructureContainer && output.energy > 0.5 * supplier.carryCapacity) {
// 				viableTargets.push(output);
// 			}
// 		}
// 		let target = supplier.pos.findClosestByMultiRoomRange(viableTargets);
// 		if (target) {
// 			supplier.task = Tasks.withdraw(target);
// 		}
// 	}
//
// 	private handleSupplier(supplier: Zerg) {
// 		if (supplier.carry.energy > 0) {
// 			this.supplyActions(supplier);
// 		} else {
// 			this.rechargeActions(supplier);
// 		}
// 	}
//
// 	run() {
// 		for (let supplier of this.suppliers) {
// 			if (supplier.isIdle) {
// 				this.handleSupplier(supplier);
// 			}
// 			supplier.run();
// 		}
// 	}
// }
