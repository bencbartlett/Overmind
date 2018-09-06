import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {DestroyerOverlord} from '../../overlords/offense/destroyer';
import {CombatIntel} from '../../intel/CombatIntel';
import {log} from '../../console/log';

@profile
export class DirectiveDestroy extends Directive {

	static directiveName = 'destroy';
	static color = COLOR_RED;
	static secondaryColor = COLOR_CYAN;

	overlords: {
		destroy: DestroyerOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.destroy = new DestroyerOverlord(this);
	}

	init(): void {

	}

	run(): void {
		// If there are no hostiles left in the room then remove the flag and associated healpoint
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			log.notify(`Destroyer mission at ${this.pos.roomName} completed successfully.`);
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
		let fallback = CombatIntel.getFallbackFrom(this.overlords.destroy.directive.pos);
		Visualizer.marker(fallback, {color: 'green'});
	}
}
