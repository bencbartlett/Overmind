// Emergency directive: recover from a catastrophic room crash

import {Directive} from './Directive';
import {profileClass} from '../profiling';
import {SupplierSetup} from '../roles/supplier';
import {log} from '../lib/logger/log';
import {MinerSetup} from '../roles/miner';

export const EMERGENCY_ENERGY_THRESHOLD = 1300;

export class DirectiveEmergency extends Directive {
	colony: IColony; 				// Emergency flag definitely has a colony
	room: Room;						// Definitely has a room

	static directiveName = 'emergency';
	static colorCode = {
		color         : COLOR_ORANGE,
		secondaryColor: COLOR_ORANGE,
	};

	constructor(flag: Flag) {
		super(flag);
	}

	private spawnEmergencyMiner(source: Source): void {
		let emergencyMiner = new MinerSetup().create(this.colony, {
			assignment            : source,
			patternRepetitionLimit: 1
		});
		this.colony.hatchery!.enqueue(emergencyMiner, -2);
	}

	private spawnEmergencySupplier(): void {
		let emergencySupplier = new SupplierSetup().create(this.colony, {
			assignment            : this.room.controller,
			patternRepetitionLimit: 2
		});
		this.colony.hatchery!.enqueue(emergencySupplier, -1);
	}

	init(): void {
		this.colony.hatchery!.emergencyMode = true;
		if (Game.time % 100 == 0) {
			log.alert(`Colony ${this.room.name} is in emergency recovery mode.`);
		}
		// If there are no miners, spawn these first
		let unattendedSources = _.filter(this.room.sources, source => source.getAssignedCreeps('miner').length == 0);
		if (unattendedSources.length > 0) {
			this.spawnEmergencyMiner(unattendedSources[0]);
		} else if (this.colony.getCreepsByRole('supplier').length == 0) {
			this.spawnEmergencySupplier();
		}
	}

	run(): void {
		if (this.colony.getCreepsByRole('miner').length > 0 &&
			this.colony.getCreepsByRole('supplier').length > 0 &&
			this.room.energyAvailable >= _.min([EMERGENCY_ENERGY_THRESHOLD, this.room.energyCapacityAvailable])) {
			log.alert(`Colony ${this.room.name} has recovered from crash; removing emergency directive.`);
			this.remove();
		}
	}
}

profileClass(DirectiveEmergency);
