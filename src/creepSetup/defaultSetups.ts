import {CreepSetup} from './CreepSetup';

export class MinerSetup extends CreepSetup {
	static role = 'miner';

	constructor() {
		super(MinerSetup.role, {
			pattern  : [WORK, WORK, CARRY, MOVE],
			sizeLimit: 3,
		});
	}
}

export class ClaimerSetup extends CreepSetup {
	static role = 'claimer';

	constructor() {
		super(ClaimerSetup.role, {
			pattern  : [CLAIM, MOVE],
			sizeLimit: 1
		});
	}
}

export class GuardSetup extends CreepSetup {
	static role = 'guard';

	constructor() {
		super(GuardSetup.role, {
			pattern  : [TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, HEAL],
			sizeLimit: 3,
		});
	}
}

export class HaulerSetup extends CreepSetup {
	static role = 'hauler';

	constructor() {
		super(HaulerSetup.role, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: Infinity,

		});
	}
}

export class ManagerSetup extends CreepSetup {
	static role = 'manager';

	constructor() {
		super(ManagerSetup.role, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: 8,
		});
	}
}

export class PioneerSetup extends CreepSetup {
	static role = 'pioneer';

	constructor() {
		super(PioneerSetup.role, {
			pattern  : [WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		});
	}
}

export class QueenSetup extends CreepSetup {
	static role = 'queen';

	constructor() {
		super(QueenSetup.role, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: 8,
		});
	}
}

export class ReserverSetup extends CreepSetup {
	static role = 'reserver';

	constructor() {
		super(ReserverSetup.role, {
			pattern  : [CLAIM, MOVE],
			sizeLimit: 4,
		});
	}
}

export class ScoutSetup extends CreepSetup {
	static role = 'scout';

	constructor() {
		super(ScoutSetup.role, {
			pattern  : [MOVE],
			sizeLimit: 1,
		});
	}
}

export class SupplierSetup extends CreepSetup {

	static role = 'supplier';

	constructor(sizeLimit: number) {
		super(SupplierSetup.role, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: sizeLimit,
		});
	}
}

export class TransporterSetup extends CreepSetup {
	static role = 'transport';

	constructor() {
		super(TransporterSetup.role, {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: Infinity,

		});
	}
}

export class UpgraderSetup extends CreepSetup {
	static role = 'upgrader';

	constructor(sizeLimit: number) {
		super(UpgraderSetup.role, {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: sizeLimit,
		});
	}
}

export class WorkerSetup extends CreepSetup {
	static role = 'worker';

	constructor() {
		super(WorkerSetup.role, {
			pattern  : [WORK, CARRY, MOVE],
			sizeLimit: Infinity,
		});
	}
}