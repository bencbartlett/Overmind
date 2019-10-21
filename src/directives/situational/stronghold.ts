import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {PowerDrillOverlord} from '../../overlords/powerMining/PowerDrill';
import {calculateFormationStrength} from "../../utilities/creepUtils";
import {PowerHaulingOverlord} from "../../overlords/powerMining/PowerHauler";
import {log} from "../../console/log";
import {StrongholdOverlord} from "../../overlords/situational/stronghold";


interface DirectiveStrongholdMemory extends FlagMemory {
	totalResources?: number;
	strongholdLevel: number;
	/*
		0: init
		1: attacking started
		2: next stage
		3: attacking finished, cleanup
		4: hauling picking is complete
	 */
	state: number;
}


/**
 * PowerMining directive: kills power banks and collects the resources.
 */
@profile
export class DirectiveStronghold extends Directive {

	static directiveName = 'stronghold';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_PURPLE;
	static requiredRCL = 7;
	private _core: StructurePowerBank | undefined;

	memory: DirectiveStrongholdMemory;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectiveStronghold.requiredRCL);
		this.memory.state = this.memory.state || 0;
	}

	spawnMoarOverlords() {
		this.overlords.strongholdKiller = new StrongholdOverlord(this);
		if (this.memory.state < 3) {
			//this.overlords.stronghold = new PowerDrillOverlord(this);
		}
		if (this.memory.state > 1) {
			//this.overlords.powerHaul = new PowerHaulingOverlord(this);
		}
	}

	manageState() {
		let currentState = this.memory.state;

	}

	init(): void {
		let alert;
		alert = `Stronghold ${'level'} ${this.memory.state}`;
		this.alert(alert);
	}

	run(): void {
		// Check frequently when almost mined and occasionally otherwise
		const frequency = this.memory.state == 2 ? 1 : 21;
		if (this.colony.commandCenter && this.colony.commandCenter.observer) {
			this.colony.commandCenter.requestRoomObservation(this.pos.roomName);
		}
		this.manageState();
	}
}

