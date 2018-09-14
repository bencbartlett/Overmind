import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {CombatIntel} from '../../intel/CombatIntel';
import {log} from '../../console/log';
import {SwarmDestroyerOverlord} from '../../overlords/offense/swarmDestroyer';

@profile
export class DirectiveSwarmDestroy extends Directive {

	static directiveName = 'destroy';
	static color = COLOR_RED;
	static secondaryColor = COLOR_RED;

	overlords: {
		destroy: SwarmDestroyerOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.destroy = new SwarmDestroyerOverlord(this);
	}

	init(): void {

	}

	run(): void {
		// If there are no hostiles left in the room then remove the flag and associated healpoint
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			log.notify(`Swarm destroyer mission at ${this.pos.roomName} completed successfully.`);
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
		let fallback = CombatIntel.getFallbackFrom(this.overlords.destroy.directive.pos);
		Visualizer.marker(fallback, {color: 'green'});
	}
}
