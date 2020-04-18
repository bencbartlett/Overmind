import {$} from '../../caching/GlobalCache';
import {log} from '../../console/log';
import {TemplateOverlord} from '../../overlords/~template/templateOverlord';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';


// Memory should have an interface extending flag memory and should not be exported
interface DirectiveTemplateMemory extends FlagMemory {
	memoryProperty1: number;
	memoryProperty2?: boolean;
}

// Default memory should be wrapped as a function to avoid default-modifying bugs
const getDefaultDirectiveTemplateMemory: () => DirectiveTemplateMemory = () => ({
	memoryProperty1: 69,
});

// If you are using a state that can be one of only a few values, it should be an enum type
const enum DirectiveTemplateState {
	state1 = 'one',
	state2 = 'two',
	state3 = 'three',
}

/**
 * Template directive that you can copy/paste as an example of how to write a directive. Some description of what
 * the directive does should go in this multi-comment.
 */
@profile
export class DirectiveTemplate extends Directive {

	// All directives must have these three static properties
	static directiveName = 'template';
	static color = COLOR_BROWN;
	static secondaryColor = COLOR_BROWN;

	// If the directive requires a certain RCL, add this static property
	static requriedRCL = 7;

	// Type the memory if you use it
	memory: DirectiveTemplateMemory;

	// If for some reason you know that you will have vision of a room, you may re-type the room property here
	room: Room;

	// You should type the overlords you put on a directive
	overlords: {
		overlordName: TemplateOverlord;
	};

	// Unless absolutely necessary, all properties on a directive shold be private.
	// Additionally, properties that refer to game objects like creeps or structures should most likely go on the
	// associated overlord, not the directive
	private property1: boolean;
	private property2: number;

	// If you are using a state that can be one of only a few values, it should be an enum type
	private state: DirectiveTemplateState;

	/**
	 * constructor() tips:
	 * - If you need to filter a colony by required RCL, put a static property on the directive
	 * - If the only thing you do is call super(flag) then you may omit the constructor entirely
	 * - If you have to recompute or set some value every tick, you can directly call refresh() from the constructor
	 * - Never modify Colony.state in the constructor! Colony.state gets reset each tick, so this must go on refresh()
	 *   and refresh() must be called from the constructor.
	 */
	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectiveTemplate.requriedRCL);
		_.defaultsDeep(this.memory, getDefaultDirectiveTemplateMemory());
		this.refresh();
	}

	/**
	 * refresh() tips:
	 * - If the only thing you do here is call super.refresh(), you may omit this method entirely
	 * - Don't forget to call super.refresh() before you do anything else in this method!
	 * - Any modifications to Colony.state must go in refresh()
	 * - Only put things in here that you need to recalculate every tick. Expensive computations that can be cached
	 *   should go on the constructor, and you can use $.someMethod() to update the properties here.
	 */
	refresh(): void {
		super.refresh();
		this.property2 = $.number(this, 'property1', () => {
			return 42; // some expensive computation
		});
		this.colony.state.bootstrapping = true;
	}

	spawnMoarOverlords(): void {
		this.overlords.overlordName = new TemplateOverlord(this);
	}

	/**
	 * If you need to place logic which is specific to this directive type but not to this directive instance and which
	 * is used elsewhere, make it a static method. Helper methods should be placed above the phase in which they are
	 * called. (So if it is called in run(), it should go between init and run)
	 */
	static shouldDoSomethingToPos(pos: RoomPosition): boolean {
		return false;
	}

	/**
	 * init() tips:
	 * - Calls to this.alert() should generally be placed in init() rather than run, but this is not a hard requirement
	 * - Only place alerts for things that are actually important enough to warrrant screen space
	 *
	 */
	init(): void {
		this.alert(`High priority notification!`, NotifierPriority.High);
		this.alert(`Regular notifiaction`);
		// this.alert(`Notification that really isn't necessary to see shouldn't go here`);
		if (Game.time % 10 == 0) {
			log.alert(`Very, very important stuff (or stuff that is definitely an error) may be console spammed`);
		}
	}

	/**
	 * run() tips:
	 * - Directive removal logic should go on run() (and only on run) if necessary
	 */
	run(): void {
		if (this.room && this.room.hostiles.length == 0 && Game.time > this.memory[MEM.TICK]! + 5000) {
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
	}
}
