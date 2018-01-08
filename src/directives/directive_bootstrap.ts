// Emergency directive: recover from a catastrophic room crash

import {Directive} from './Directive';
import {log} from '../lib/logger/log';
import {profile} from '../lib/Profiler';


export const EMERGENCY_ENERGY_THRESHOLD = 1300;

@profile
export class DirectiveBootstrap extends Directive {
	colony: IColony; 				// Emergency flag definitely has a colony
	room: Room;						// Definitely has a room
	unattendedSources: Source[];
	private needsMiner: boolean;
	private needsManager: boolean;
	private needsSupplier: boolean;

	static directiveName = 'emergency';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_ORANGE;

	constructor(flag: Flag) {
		super(flag);
		this.needsMiner = (this.colony.getCreepsByRole('miner').length > 0);
		this.needsManager = (this.colony.commandCenter != undefined &&
							 this.colony.commandCenter.overlord != undefined &&
							 this.colony.getCreepsByRole('manager').length > 0);
		this.needsSupplier = (this.colony.getCreepsByRole('supplier').length == 0);
	}

	// private spawnEmergencyMiner(source: Source): void {
	// 	let emergencyMiner = new MinerSetup().create(this.colony, {
	// 		assignment            : source,
	// 		patternRepetitionLimit: 1
	// 	});
	// 	this.colony.hatchery!.enqueue(emergencyMiner, -3);
	// }
	//
	// private spawnEmergencyManager(): void {
	// 	let emergencyManager = new ManagerSetup().create(this.colony, {
	// 		assignment            : this.room.storage,
	// 		patternRepetitionLimit: 2
	// 	});
	// 	this.colony.hatchery!.enqueue(emergencyManager, -2);
	// }
	//
	// private spawnEmergencySupplier(): void {
	// 	let emergencySupplier = new SupplierSetup().create(this.colony, {
	// 		assignment            : this.room.controller,
	// 		patternRepetitionLimit: 2
	// 	});
	// 	this.colony.hatchery!.enqueue(emergencySupplier, -1);
	// }


	init(): void {
		// this.colony.hatchery!.emergencyMode = true;
		if (Game.time % 100 == 0) {
			log.alert(`Colony ${this.room.name} is in emergency recovery mode.`);
		}
		//
		// // Spawn emergency creeps as needed
		// if (this.needsMiner) {
		// 	this.spawnEmergencyMiner(this.unattendedSources[0]);
		// }
		// if (this.needsManager) {
		// 	this.spawnEmergencyManager();
		// }
		// if (this.needsSupplier) {
		// 	this.spawnEmergencySupplier();
		// }
	}

	run(): void {
		if (!this.needsMiner && !this.needsManager && !this.needsSupplier &&
			this.room.energyAvailable >= _.min([EMERGENCY_ENERGY_THRESHOLD, this.room.energyCapacityAvailable])) {
			log.alert(`Colony ${this.room.name} has recovered from crash; removing emergency directive.`);
			this.remove();
		}
	}
}
