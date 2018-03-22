// // Temporary mineral supplier to work labs while I finish up the massive logistics update
//
// import {CreepSetup} from '../creepSetup/CreepSetup';
// import {Overlord} from '../overlords/Overlord';
// import {Zerg} from '../Zerg';
// import {Colony} from '../Colony';
// import {OverlordPriority} from '../overlords/priorities_overlords';
// import {HiveCluster} from '../hiveClusters/HiveCluster';
// import {DirectiveLabMineral} from '../directives/logistics/directive_labMineralType';
// import {TaskTransfer} from '../tasks/task_transfer';
// import {TaskWithdrawResource} from '../tasks/task_withdrawResource';
//
// export class MineralSupplierSetup extends CreepSetup {
//
// 	static role = 'mineralSupplier';
//
// 	constructor(sizeLimit: number) {
// 		super(MineralSupplierSetup.role, {
// 			pattern  : [CARRY, CARRY, MOVE],
// 			sizeLimit: sizeLimit,
// 		});
// 	}
// }
//
// export class MineralSupplierOverlord extends Overlord {
//
// 	mineralSuppliers: Zerg[];
// 	room: Room;
//
// 	constructor(colony: Colony | HiveCluster, priority = OverlordPriority.ownedRoom.mineralSupply) {
// 		super(colony, 'mineralSupply', priority);
// 		this.mineralSuppliers = this.creeps(MineralSupplierSetup.role);
// 	}
//
// 	init() {
// 		this.wishlist(1, new MineralSupplierSetup(5));
// 	}
//
// 	private handleMineralSupplier(mineralSupplier: Zerg) {
// 		let flaggedLabs = _.compact(_.map(DirectiveLabMineral.find(this.room.flags) as DirectiveLabMineral[],
// 										  directive => directive.lab)) as StructureLab[];
// 		let labsNeedingMinerals = _.filter(flaggedLabs, lab => lab.mineralAmount < lab.mineralCapacity);
// 		let target = mineralSupplier.pos.findClosestByRange(labsNeedingMinerals);
// 		if (target) {
// 			let mineralType = target.getMineralType();
// 			if (mineralType && this.colony.terminal) {
// 				// Get rid of excess minerals
// 				let carry = mineralSupplier.carry as { [resource: string]: number };
// 				for (let resource in carry) {
// 					if (resource != mineralType && carry[resource] > 0) {
// 						mineralSupplier.task = new TaskTransfer(this.colony.terminal, <ResourceConstant>resource);
// 						return;
// 					}
// 				}
// 				if (mineralSupplier.carry[mineralType] && mineralSupplier.carry[mineralType]! > 0) {
// 					mineralSupplier.task = new TaskTransfer(target, mineralType);
// 				} else {
// 					let amount = _.min([target.mineralCapacity - target.mineralAmount,
// 										this.colony.terminal.store[mineralType],
// 										mineralSupplier.carryCapacity - _.sum(mineralSupplier.carry)]);
// 					mineralSupplier.task = new TaskWithdrawResource(this.colony.terminal, mineralType, amount);
// 				}
// 				// // Withdraw what you need and transfer to lab
// 				// let amount = _.min([target.mineralCapacity - target.mineralAmount,
// 				// 					this.colony.terminal.store[mineralType],
// 				// 					mineralSupplier.carryCapacity - _.sum(mineralSupplier.carry)]);
// 				// let transfer = new TaskTransfer(target, mineralType, amount);
// 				// let task = new TaskWithdrawResource(this.colony.terminal, mineralType, amount);
// 				// task.parent = transfer;
// 				// mineralSupplier.task = task;
// 			}
// 		}
// 	}
//
// 	private handleMineralSupplierDeath(mineralSupplier: Zerg) {
// 		let carry = mineralSupplier.carry as { [resource: string]: number };
// 		for (let resource in carry) {
// 			if (carry[resource] > 0) {
// 				mineralSupplier.task = new TaskTransfer(this.colony.terminal!, <ResourceConstant>resource);
// 				return;
// 			}
// 		}
// 		mineralSupplier.suicide();
// 	}
//
// 	run() {
// 		for (let mineralSupplier of this.mineralSuppliers) {
// 			if (mineralSupplier.isIdle) {
// 				if (mineralSupplier.ticksToLive! > 100) {
// 					this.handleMineralSupplier(mineralSupplier);
// 				} else {
// 					this.handleMineralSupplierDeath(mineralSupplier);
// 				}
// 			}
// 			if (mineralSupplier.ticksToLive == 100) {
// 				mineralSupplier.task = null; // Interrupt what you're doing when you get too old
// 			}
// 			mineralSupplier.run();
// 		}
// 	}
//
// }