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
	let role;
	switch (roleName) {
		case 'claimer':
			role =  new ClaimerCreep(creep);
			break;
		case 'destroyer':
			role =  new DestroyerCreep(creep);
			break;
		case 'guard':
			role =  new GuardCreep(creep);
			break;
		case 'hauler':
			role =  new HaulerCreep(creep);
			break;
		case 'healer':
			role =  new HealerCreep(creep);
			break;
		case 'manager':
			role =  new ManagerCreep(creep);
			break;
		case 'miner':
			role =  new MinerCreep(creep);
			break;
		case 'mineralSupplier':
			role =  new MineralSupplierCreep(creep);
			break;
		case 'reserver':
			role =  new ReserverCreep(creep);
			break;
		case 'scout':
			role =  new ScoutCreep(creep);
			break;
		case 'sieger':
			role =  new SiegerCreep(creep);
			break;
		case 'supplier':
			role =  new SupplierCreep(creep);
			break;
		case 'upgrader':
			role =  new UpgraderCreep(creep);
			break;
		case 'worker':
			role =  new WorkerCreep(creep);
			break;
	}
	return role!;
}
