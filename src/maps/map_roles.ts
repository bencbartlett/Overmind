// Wrapper for task require statements.
// Example:
// var roles = require('roles');
// var role = roles('upgrader');

import {AbstractCreep} from '../roles/Abstract';
import {ClaimerCreep} from '../roles/claimer';
import {DestroyerCreep} from '../roles/destroyer';
import {GuardCreep} from '../roles/guard';
import {HaulerCreep} from '../roles/hauler';
import {HealerCreep} from '../roles/healer';
// import {LinkerCreep} from '../roles/linker';
import {MinerCreep} from '../roles/miner';
import {MineralSupplierCreep} from '../roles/mineralSupplier';
import {ReserverCreep} from '../roles/reserver';
import {ScoutCreep} from '../roles/scout';
import {SiegerCreep} from '../roles/sieger';
import {SupplierCreep} from '../roles/supplier';
import {UpgraderCreep} from '../roles/upgrader';
import {WorkerCreep} from '../roles/worker';
import {ManagerCreep} from '../roles/manager';

export function AbstractCreepWrapper(creep: Creep): AbstractCreep {
	let roleName = creep.memory.role;
	switch (roleName) {
		case 'claimer':
			return new ClaimerCreep(creep);
		case 'destroyer':
			return new DestroyerCreep(creep);
		case 'guard':
			return new GuardCreep(creep);
		case 'hauler':
			return new HaulerCreep(creep);
		case 'healer':
			return new HealerCreep(creep);
		// case 'linker':
		// 	return new LinkerCreep(creep);
		case 'manager':
			return new ManagerCreep(creep);
		case 'miner':
			return new MinerCreep(creep);
		case 'mineralSupplier':
			return new MineralSupplierCreep(creep);
		case 'reserver':
			return new ReserverCreep(creep);
		case 'scout':
			return new ScoutCreep(creep);
		case 'sieger':
			return new SiegerCreep(creep);
		case 'supplier':
			return new SupplierCreep(creep);
		case 'upgrader':
			return new UpgraderCreep(creep);
		case 'worker':
			return new WorkerCreep(creep);
	}
}
