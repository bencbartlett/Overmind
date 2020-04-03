import {log} from '../../console/log';
import {LeecherOverlord} from '../../overlords/mining/leecher';
import {profile} from '../../profiler/decorator';
import {Cartographer,ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {Directive} from '../Directive';

/**
 * Leech energy from near by rooms harvested/reserved by enemy players
 */
interface DirectiveLeechMemory extends FlagMemory {
	totalCost: number;
	totalLeech: number;
}
@profile
export class DirectiveLeech extends Directive {

	static directiveName = 'leech';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_ORANGE;
	memory: DirectiveLeechMemory;

	constructor(flag: Flag) {
		super(flag);
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			this.remove();
			log.notify(`Removing leech directive in ${this.pos.roomName}: must be a controller room`);
		}
	}

	spawnMoarOverlords() {
		this.overlords.leech = new LeecherOverlord(this);
	}

	init() {
		this.alert(`Leeching room  ${this.pos.roomName}`);
	}

	run() {
		// leaving the below constantly on for observation
		if( true && // Game.time % 50 == 0 &&
		   this.memory.totalLeech && this.memory.totalCost && 
		   this.memory.totalLeech < this.memory.totalCost &&
		   this.memory.totalCost > 2500) {
			log.notify(`Removing leech directive in ${this.pos.roomName}: making loss ${this.memory.totalLeech - this.memory.totalCost}`);
			console.log(`Removing leech directive in ${this.pos.roomName}: making loss ${this.memory.totalLeech - this.memory.totalCost}`);
			// this.remove();
		   }
	}

}


