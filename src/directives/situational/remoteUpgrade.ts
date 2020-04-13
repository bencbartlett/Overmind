import {Colony} from '../../Colony';
import {RemoteUpgradingOverlord} from '../../overlords/situational/remoteUpgrader';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';

/**
 * Spawns remote upgraders and energy carriers to travel to a distant room to upgrade the controller. The directive
 * should be placed on the controller in the child room and should only be used after the room has been claimed.
 */
@profile
export class DirectiveRemoteUpgrade extends Directive {

	static directiveName = 'remoteUpgrade';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_YELLOW;

	static requiredRCL = 8;

	overlords: {
		remoteUpgrade: RemoteUpgradingOverlord
	};

	constructor(flag: Flag) {
		flag.memory.allowPortals = true;
		super(flag, (colony: Colony) => colony.level >= DirectiveRemoteUpgrade.requiredRCL);
	}

	spawnMoarOverlords() {
		this.overlords.remoteUpgrade = new RemoteUpgradingOverlord(this);
	}

	init(): void {
		this.alert(`Remote upgrade active`);
	}

	run(): void {
		if (this.room && this.room.controller && this.room.controller.level == 8) {
			this.remove();
		}
	}
}
