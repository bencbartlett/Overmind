// Emergency directive: recover from a catastrophic room crash

import {Directive} from '../Directive';
import {log} from '../../lib/logger/log';
import {profile} from '../../profiler/decorator';
import {BootstrappingOverlord} from '../../overlords/situational/bootstrap';
import {Colony} from '../../Colony';
import {MinerSetup} from '../../overlords/core/miner';
import {ManagerSetup} from '../../overlords/core/manager';
import {QueenSetup} from '../../overlords/core/queen';


export const EMERGENCY_ENERGY_THRESHOLD = 1300;

@profile
export class DirectiveBootstrap extends Directive {

	static directiveName = 'bootstrap';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_ORANGE;

	colony: Colony; 					// Emergency flag definitely has a colony
	room: Room;							// Definitely has a room
	private needsEnergy: boolean; 		// Whether there is enough energy in the room
	private needsMiner: boolean;		// Whether a miner needs to be spawned
	private needsManager: boolean;		// Whether a manager needs to be spawned
	private needsQueen: boolean;		// Whether a supplier needs to be spawned

	constructor(flag: Flag) {
		super(flag);
		this.colony.bootstrapping = true;
		this.needsEnergy = this.room.energyAvailable < _.min([EMERGENCY_ENERGY_THRESHOLD,
															  this.room.energyCapacityAvailable]);
		this.needsMiner = (this.colony.getCreepsByRole(MinerSetup.role).length == 0);
		this.needsManager = (this.colony.commandCenter != undefined &&
							 this.colony.commandCenter.overlord != undefined &&
							 this.colony.getCreepsByRole(ManagerSetup.role).length == 0);
		this.needsQueen = (this.colony.getCreepsByRole(QueenSetup.role).length == 0);
		this.overlords.bootstrap = new BootstrappingOverlord(this);
	}

	init(): void {
		if (Game.time % 100 == 0) {
			log.alert(`Colony ${this.room.print} is in emergency recovery mode.`);
		}
	}

	run(): void {
		if (!this.needsMiner && !this.needsManager && !this.needsQueen) {
			log.alert(`Colony ${this.room.name} has recovered from crash; removing bootstrap directive.`);
			// Suicide any fillers so they don't get in the way
			let overlord = this.overlords.bootstrap as BootstrappingOverlord;
			for (let filler of overlord.fillers) {
				filler.suicide();
			}
			// Remove the directive
			this.remove();
		}
	}
}
