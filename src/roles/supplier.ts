// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage
// Used for energy collection before storage is built and mining groups spawn

import {AbstractCreep, AbstractSetup} from './Abstract';
import {profileClass} from '../profiling';


export class SupplierSetup extends AbstractSetup {
	constructor() {
		super('supplier');
		// Role-specific settings
		this.body.pattern = [CARRY, CARRY, MOVE];
	}
}

export class SupplierCreep extends AbstractCreep {
	assignment: StructureController;

	constructor(creep: Creep) {
		super(creep);
	}

	// private supplyActions(): void {
	// 	let supplyTargets = _.map(this.colony.overlord.resourceRequests.resourceIn.haul,
	// 								(request: IResourceRequest) => request.target);
	// 	if (supplyTargets.length > 0) {
	// 		this.task = new TaskWithdraw(this.pos.findClosestByRange(supplyTargets));
	// 	}
	// }
	//
	// private withdrawActions(): void {
	// 	let withdrawTargets = _.map(this.colony.overlord.resourceRequests.resourceOut.haul,
	// 								(request: IResourceRequest) => request.target);
	// 	if (withdrawTargets.length > 0) {
	// 		this.task = new TaskWithdraw(this.pos.findClosestByRange(withdrawTargets));
	// 	} else if (this.room.storage) {
	// 		this.task = new TaskWithdraw(this.room.storage);
	// 	}
	// }
	//
	// newTask(): void {
	// 	this.task = null;
	// 	if (this.carry.energy > 0) {
	// 		this.supplyActions();
	// 	} else {
	// 		this.withdrawActions();
	// 	}
	// }

}

profileClass(SupplierSetup);
profileClass(SupplierCreep);
