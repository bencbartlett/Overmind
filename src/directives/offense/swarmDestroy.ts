import {log} from '../../console/log';
import {SwarmDestroyerOverlord} from '../../overlords/offense/swarmDestroyer';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

/**
 * Spawns a 2x2 squad of coordinated creeps to destroy a room
 */
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
		this.alert(`Swarm destroyer directive active`);
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
	}
}
