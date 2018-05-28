import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {DestroyerOverlord} from '../../overlords/offense/destroyer';

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
		this.overlords.destroy = new DestroyerOverlord(this);
	}

	init(): void {

	}

	run(): void {
		// If there are no hostiles left in the room then remove the flag and associated healpoint
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			Game.notify(`Destroyer mission at ${this.pos.roomName} completed successfully.`);
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
		Visualizer.marker(this.overlords.destroy.fallback, {color: 'green'});
	}
}
