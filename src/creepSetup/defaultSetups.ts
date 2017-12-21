import {CreepSetup} from './CreepSetup';

export class MinerSetup extends CreepSetup {
	constructor() {
		super('miner', {
			pattern  : [WORK, WORK, CARRY, MOVE],
			sizeLimit: 3,
		});
	}
}

export class ClaimerSetup extends CreepSetup {
	constructor() {
		super('claimer', {
			pattern  : [CLAIM, MOVE],
			sizeLimit: 1
		});
	}
}

export class GuardSetup extends CreepSetup {
	constructor() {
		super('guard', {
			pattern  : [TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, HEAL],
			sizeLimit: 3,
		});
	}
}

export class HaulerSetup extends CreepSetup {
	constructor() {
		super('hauler', {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: Infinity,

		});
	}
}

export class ManagerSetup extends CreepSetup {
	constructor() {
		super('manager', {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: 8,
		});
	}
}

export class QueenSetup extends CreepSetup {
	constructor() {
		super('queen', {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: 8,
		});
	}
}

export class ReserverSetup extends CreepSetup {
	constructor() {
		super('reserver', {
			pattern  : [CLAIM, MOVE],
			sizeLimit: 4,
		});
	}
}

export class ScoutSetup extends CreepSetup {
	constructor() {
		super('scout', {
			pattern  : [MOVE],
			sizeLimit: 1,
		});
	}
}

export class SupplierSetup extends CreepSetup {
	constructor(sizeLimit: number) {
		super('supplier', {
			pattern  : [CARRY, CARRY, MOVE],
			sizeLimit: sizeLimit,
		});
	}
}

export class UpgraderSetup extends CreepSetup {
	constructor(sizeLimit: number) {
		super('upgrader', {
			pattern  : [WORK, WORK, WORK, CARRY, MOVE],
			sizeLimit: sizeLimit,
		});
	}
}