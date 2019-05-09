/**
 * Creep tasks setup instructions
 *
 * Javascript:
 * 1. In main.js:   require("tasks/prototypes.js");
 * 2. As needed:    var Tasks = require("<path to Tasks.js>");
 *
 * Typescript:
 * 1. In main.ts:   import "./tasks/prototypes";
 * 2. As needed:    import {Tasks} from "<path to Tasks.ts>"
 *
 * If you use Travler, change all occurrences of creep.moveTo() to creep.goTo()
 */

import {log} from '../console/log';
import {profile} from '../profiler/decorator';
import {Zerg} from '../zerg/Zerg';
import {initializeTask} from './initializer';

type targetType = { ref: string, pos: ProtoPos }; // overwrite this variable to specify more precise typing

/**
 * An abstract class for encapsulating creep actions. This generalizes the concept of "do action X to thing Y until
 * condition Z is met" and saves a lot of convoluted and duplicated code in creep logic. A Task object contains
 * the necessary logic for traveling to a target, performing a task, and realizing when a task is no longer sensible
 * to continue.
 */
@profile
export abstract class Task {

	static taskName: string;

	name: string;				// Name of the task type, e.g. 'upgrade'
	_creep: { 					// Data for the creep the task is assigned to"
		name: string;				// Name of the creep
	};
	_target: { 					// Data for the target the task is directed to:
		ref: string; 				// Target id or name
		_pos: ProtoPos; 			// Target position's coordinates in case vision is lost
	};
	_parent: ProtoTask | null; 	// The parent of this task, if any. Task is changed to parent upon completion.
	tick: number;				// When the task was set
	settings: TaskSettings;		// Settings for a given type of task; shouldn't be modified on an instance-basis
	options: TaskOptions;		// Options for a specific instance of a task
	data: TaskData; 			// Data pertaining to a given instance of a task

	private _targetPos: RoomPosition;

	constructor(taskName: string, target: targetType, options = {} as TaskOptions) {
		// Parameters for the task
		this.name = taskName;
		this._creep = {
			name: '',
		};
		if (target) { // Handles edge cases like when you're done building something and target disappears
			this._target = {
				ref : target.ref,
				_pos: target.pos,
			};
		} else {
			this._target = {
				ref : '',
				_pos: {
					x       : -1,
					y       : -1,
					roomName: '',
				}
			};
		}
		this._parent = null;
		this.settings = {
			targetRange: 1,			// range at which you can perform action
			workOffRoad: false,		// whether work() should be performed off road
			oneShot    : false, 	// remove this task once work() returns OK, regardless of validity
			timeout    : Infinity, 	// task becomes invalid after this long
			blind      : true,  	// don't require vision of target unless in room
		};
		this.tick = Game.time;
		this.options = options;
		this.data = {};
	}

	/**
	 * Get a serialized ProtoTask from the current task
	 */
	get proto(): ProtoTask {
		return {
			name   : this.name,
			_creep : this._creep,
			_target: this._target,
			_parent: this._parent,
			tick   : this.tick,
			options: this.options,
			data   : this.data,
		};
	}

	/**
	 * Set the current task from a serialized ProtoTask
	 */
	set proto(protoTask: ProtoTask) {
		// Don't write to this.name; used in task switcher
		this._creep = protoTask._creep;
		this._target = protoTask._target;
		this._parent = protoTask._parent;
		this.tick = protoTask.tick;
		this.options = protoTask.options;
		this.data = protoTask.data;
	}

	/**
	 * Return the wrapped creep which is executing this task
	 */
	get creep(): Zerg { // Get task's own creep by its name
		// Returns zerg wrapper instead of creep to use monkey-patched functions
		return Overmind.zerg[this._creep.name];
	}

	/**
	 * Set the creep which is executing this task
	 */
	set creep(creep: Zerg) {
		this._creep.name = creep.name;
		if (this._parent) {
			this.parent!.creep = creep;
		}
	}

	/**
	 * Dereferences the Task's target
	 */
	get target(): RoomObject | null {
		return deref(this._target.ref);
	}

	/**
	 * Dereferences the saved target position; useful for situations where you might lose vision
	 */
	get targetPos(): RoomPosition {
		// refresh if you have visibility of the target
		if (!this._targetPos) {
			if (this.target) {
				this._target._pos = this.target.pos;
			}
			this._targetPos = derefRoomPosition(this._target._pos);
		}
		return this._targetPos;
	}

	/**
	 * Get the Task's parent
	 */
	get parent(): Task | null {
		return (this._parent ? initializeTask(this._parent) : null);
	}

	/**
	 * Set the Task's parent
	 */
	set parent(parentTask: Task | null) {
		this._parent = parentTask ? parentTask.proto : null;
		// If the task is already assigned to a creep, update their memory
		if (this.creep) {
			this.creep.task = this;
		}
	}

	/**
	 * Return a list of [this, this.parent, this.parent.parent, ...] as tasks
	 */
	get manifest(): Task[] {
		const manifest: Task[] = [this];
		let parent = this.parent;
		while (parent) {
			manifest.push(parent);
			parent = parent.parent;
		}
		return manifest;
	}

	/**
	 * Return a list of [this.target, this.parent.target, ...] without fully instantiating the list of tasks
	 */
	get targetManifest(): (RoomObject | null)[] {
		const targetRefs: string[] = [this._target.ref];
		let parent = this._parent;
		while (parent) {
			targetRefs.push(parent._target.ref);
			parent = parent._parent;
		}
		return _.map(targetRefs, ref => deref(ref));
	}

	/**
	 * Return a list of [this.targetPos, this.parent.targetPos, ...] without fully instantiating the list of tasks
	 */
	get targetPosManifest(): RoomPosition[] {
		const targetPositions: ProtoPos[] = [this._target._pos];
		let parent = this._parent;
		while (parent) {
			targetPositions.push(parent._target._pos);
			parent = parent._parent;
		}
		return _.map(targetPositions, protoPos => derefRoomPosition(protoPos));
	}

	/**
	 * Fork the task, assigning a new task to the creep with this task as its parent
	 */
	fork(newTask: Task): Task {
		newTask.parent = this;
		if (this.creep) {
			this.creep.task = newTask;
		}
		return newTask;
	}

	/**
	 * Test every tick to see if task is still valid
	 */
	abstract isValidTask(): boolean;

	/**
	 * Test every tick to see if target is still valid
	 */
	abstract isValidTarget(): boolean;


	/**
	 * Test if the task is valid; if it is not, automatically remove task and transition to parent
	 */
	isValid(): boolean {
		let validTask = false;
		if (this.creep) {
			validTask = this.isValidTask() && Game.time - this.tick < this.settings.timeout;
		}
		let validTarget = false;
		if (this.target) {
			validTarget = this.isValidTarget();
		} else if ((this.settings.blind || this.options.blind) && !Game.rooms[this.targetPos.roomName]) {
			// If you can't see the target's room but you have blind enabled, then that's okay
			validTarget = true;
		}
		// Return if the task is valid; if not, finalize/delete the task and return false
		if (validTask && validTarget) {
			return true;
		} else {
			// Switch to parent task if there is one
			this.finish();
			const isValid = this.parent ? this.parent.isValid() : false;
			return isValid;
		}
	}

	/**
	 * Move to within range of the target
	 */
	moveToTarget(range = this.settings.targetRange): number {
		return this.creep.goTo(this.targetPos, {range: range});
	}

	/**
	 * Moves to the next position on the agenda if specified - call this in some tasks after work() is completed
	 */
	moveToNextPos(): number | undefined {
		if (this.options.nextPos) {
			const nextPos = derefRoomPosition(this.options.nextPos);
			return this.creep.goTo(nextPos);
		}
	}

	/**
	 * Return expected number of ticks until creep arrives at its first destination
	 */
	get eta(): number | undefined {
		if (this.creep && this.creep.memory._go && this.creep.memory._go.path) {
			return this.creep.memory._go.path.length;
		}
	}

	/**
	 * Execute this task each tick. Returns nothing unless work is done.
	 */
	run(): number | undefined {
		if (this.isWorking) {
			delete this.creep.memory._go;
			// if (this.settings.workOffRoad) { // this is disabled as movement priorities makes it unnecessary
			// 	// Move to somewhere nearby that isn't on a road
			// 	this.creep.park(this.targetPos, true);
			// }
			const result = this.work();
			if (this.settings.oneShot && result === OK) {
				this.finish();
			}
			return result;
		} else {
			this.moveToTarget();
		}
	}

	/**
	 * Return whether the creep is currently performing its task action near the target
	 */
	get isWorking(): boolean {
		return this.creep.pos.inRangeToPos(this.targetPos, this.settings.targetRange) && !this.creep.pos.isEdge;
	}

	/**
	 * Task to perform when at the target
	 */
	abstract work(): number;

	/**
	 * Finalize the task and switch to parent task (or null if there is none)
	 */
	finish(): void {
		this.moveToNextPos();
		if (this.creep) {
			this.creep.task = this.parent;
		} else {
			log.debug(`No creep executing ${this.name}! Proto: ${JSON.stringify(this.proto)}`);
		}
	}
}

