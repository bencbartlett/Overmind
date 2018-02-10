import {log} from '../lib/logger/log';
import {taskInstantiator} from '../maps/map_tasks';
import {Zerg} from '../Zerg';

type targetType = { ref: string, pos: RoomPosition }; // overwrite this variable in derived classes to specify more precise typing

/* An abstract class for encapsulating creep actions. This generalizes the concept of "do action X to thing Y until
 * condition Z is met" and saves a lot of convoluted and duplicated code in creep logic. A Task object contains
 * the necessary logic for traveling to a target, performing a task, and realizing when a task is no longer sensible
 * to continue.*/

export abstract class Task {

	static taskName: string;

	name: string;				// Name of the task type, e.g. 'upgrade'
	_creep: { 					// Data for the creep the task is assigned to"
		name: string;				// Name of the creep
	};
	_target: { 					// Data for the target the task is directed to:
		ref: string; 				// Target id or name
		_pos: protoPos; 			// Target position's coordinates in case vision is lost
	};
	_parent: protoTask | null; 	// The parent of this task, if any. Task is changed to parent upon completion.
	settings: { 				// Data pertaining to a given type of task; shouldn't be modified on an instance-basis
		targetRange: number;		// How close you must be to the target to do the work() function
		moveColor: string; 			// Color to draw movement lines with visuals (will be re-implemented later)
		workOffRoad: boolean; 	// Should the task be performed off-road (e.g. working, upgrading, etc)
	};
	options: TaskOptions;
	data: { 					// Data pertaining to a given instance of a task
		quiet?: boolean; 			// Don't complain about shit in the console
		resourceType?: string; 		// For non-energy resource movement tasks
	};

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
			targetRange: 1,
			moveColor  : '#fff',
			workOffRoad: false,
		};
		_.defaults(options, {
			blind          : false,
			travelToOptions: {},
		});
		this.options = options;
		this.data = {
			quiet: true,
		};
		// this.target = target as RoomObject;
	}

	// Getter/setter for task.creep
	get creep(): Zerg { // Get task's own creep by its name
		return Game.zerg[this._creep.name];
	}

	set creep(creep: Zerg) {
		this._creep.name = creep.name;
	}

	// Getter/setter for task.target
	get target(): RoomObject | null {
		return deref(this._target.ref);
	}

	// set target(target: RoomObject | null) {
	// 	if (target) {
	// 		this._target.ref = target.ref;
	// 		this.targetPos = target.pos;
	// 	} else {
	// 		log.info('Null target set: something is wrong.');
	// 	}
	// }

	// Getter/setter for task.targetPos
	get targetPos(): RoomPosition {
		// refresh if you have visibility of the target
		if (this.options.travelToOptions.movingTarget && this.target) {
			this._target._pos = this.target.pos;
		}
		return derefRoomPosition(this._target._pos);
	}

	// set targetPos(targetPosition: RoomPosition) {
	// 	this._target._pos.x = targetPosition.x;
	// 	this._target._pos.y = targetPosition.y;
	// 	this._target._pos.roomName = targetPosition.roomName;
	// }

	// Getter/setter for task parent
	get parent(): Task | null {
		return (this._parent ? taskInstantiator(this._parent) : null);
	}

	set parent(parentTask: Task | null) {
		this._parent = parentTask;
		// If the task is already assigned to a creep, update their memory
		// Although assigning something to a creep and then changing the parent is bad practice...
		if (this.creep) {
			this.creep.task = this;
		}
	}

	// Fork the task, assigning a new task to the creep with this task as its parent
	fork(newTask: Task): void {
		newTask.parent = this;
		this.creep.task = newTask;
	}

	// Test every tick to see if task is still valid
	abstract isValidTask(): boolean;

	// Test every tick to see if target is still valid
	abstract isValidTarget(): boolean;

	isValid(): boolean {
		let validTask = false;
		if (this.creep) {
			validTask = this.isValidTask();
		}
		let validTarget = false;
		if (this.target) {
			validTarget = this.isValidTarget();
		} else if (this.options.blind && !Game.rooms[this.targetPos.roomName]) {
			// If you can't see the target's room but you have blind enabled, then that's okay
			validTarget = true;
		}
		// Return if the task is valid; if not, finalize/delete the task and return false
		if (validTask && validTarget) {
			return true;
		} else {
			// Switch to parent task if there is one
			let isValid = false;
			if (this.parent) {
				let isValid = this.parent.isValid();
			}
			this.finish();
			return isValid;
		}
	}

	move(): number {
		// if (this.creep.pos.isEdge && this.creep.pos.roomName == this.targetPos.roomName) {
		// 	return this.creep.move(this.creep.pos.getDirectionTo(this.targetPos));
		// }
		// let options = Object.assign({},
		// 							this.options.travelToOptions,
		// 							{range: this.settings.targetRange});
		if (this.options.travelToOptions && !this.options.travelToOptions.range) {
			this.options.travelToOptions.range = this.settings.targetRange;
		}
		return this.creep.travelTo(this.targetPos, this.options.travelToOptions);
	}

	// Execute this task each tick. Returns nothing unless work is done.
	run(): number | void {
		if (this.creep.pos.inRangeTo(this.targetPos, this.settings.targetRange) && !this.creep.pos.isEdge) {
			if (this.settings.workOffRoad) {
				// Move to somewhere nearby that isn't on a road
				this.creep.park(this.targetPos, true);
			}
			let workResult = this.work();
			if (workResult != OK && this.data.quiet == false) {
				log.debug('Error executing ' + this.name + ', returned ' + workResult);
			}
			return workResult;
		} else {
			this.move();
		}
	}

	// Task to perform when at the target
	abstract work(): number;

	// Finalize the task and switch to parent task (or null if there is none)
	finish(): void {
		if (this.creep) {
			this.creep.task = this.parent;
		}
	}
}

