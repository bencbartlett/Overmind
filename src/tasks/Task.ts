type targetType = RoomObject; // overwrite this variable in derived classes to specify more precise typing

/* An abstract class for encapsulating creep actions. This generalizes the concept of "do action X to thing Y until
 * condition Z is met" and saves a lot of convoluted and duplicated code in creep logic. A Task object contains
 * the necessary logic for traveling to a target, performing a task, and realizing when a task is no longer sensible
 * to continue.*/
export abstract class Task implements ITask {
	name: string;				// Name of the task type, e.g. 'upgrade'
	_creep: { 					// Data for the creep the task is assigned to"
		name: string;				// Name of the creep
	};
	_target: { 					// Data for the target the task is directed to:
		ref: string; 				// Target id or name
		_pos: protoPos; 			// Target position's coordinates in case vision is lost
	};
	taskData: { 				// Data pertaining to a given type of task; shouldn't be modified on an instance-basis
		targetRange: number;		// How close you must be to the target to do the work() function
		maxPerTask: number; 		// How many creeps can be assigned a type of task (DEPRECATED - see objectives)
		maxPerTarget: number;		// How many creeps can be assigned to a single target (DEPRECATED - see objectives)
		moveColor: string; 			// Color to draw movement lines with visuals (will be re-implemented later)
	};
	data: { 					// Data pertaining to a given instance of a task
		quiet: boolean; 			// Don't complain about shit in the console
		travelToOptions: any; 		// Movement options: for example, attackers can move through hostile rooms
		resourceType?: string; 		// For non-energy resource movement tasks
	};

	constructor(taskName: string, target: targetType) {
		// Parameters for the task
		this.name = taskName;
		this._creep = {
			name: '',
		};
		this._target = {
			ref : '',
			_pos: {
				x       : -1,
				y       : -1,
				roomName: '',
			},
		};
		this.taskData = {
			maxPerTarget: Infinity,
			maxPerTask  : Infinity,
			targetRange : 1,
			moveColor   : '#fff',
		};
		this.data = {
			quiet          : true,
			travelToOptions: {},
		};
		if (target) {
			this.target = target;
		} else {
			// A task must have a target. If a task is reinstantiated without a target (for example, dismantling
			// the target on the previous tick), it will be caught in the same tick by isValidTarget().
		}
	}

	// Getter/setter for task.creep
	get creep(): ICreep { // Get task's own creep by its name
		let creep = Game.icreeps[this._creep.name];
		return creep;
	}

	set creep(creep: ICreep) {
		this._creep.name = creep.name;
	}

	// Getter/setter for task.target
	get target(): RoomObject | null {
		let tar = deref(this._target.ref);
		if (!tar) {
			this.remove();
			return null;
		} else {
			return tar;
		}
	}

	set target(target: RoomObject | null) {
		if (target) {
			this._target.ref = target.ref;
			this.targetPos = target.pos;
		} else {
			this.remove();
		}
	}

	// Getter/setter for task.targetPos
	get targetPos(): RoomPosition {
		// refresh if you have visibility of the target
		if (this.target) {
			this._target._pos = this.target.pos;
		}
		return derefRoomPosition(this._target._pos);
	}

	set targetPos(targetPosition: RoomPosition) {
		this._target._pos.x = targetPosition.x;
		this._target._pos.y = targetPosition.y;
		this._target._pos.roomName = targetPosition.roomName;
	}

	// Remove the task (in case the target disappeared, usually)
	remove(): void {
		if (this.creep) {
			// this.creep.log("Deleting task " + this.name + ": target is null!");
			this.creep.task = null;
		}
	}

	// Test every tick to see if task is still valid
	abstract isValidTask(): boolean;

	// Test every tick to see if target is still valid
	abstract isValidTarget(): boolean;

	move(): number {
		let options = Object.assign({},
									this.data.travelToOptions,
									{range: this.taskData.targetRange});
		return this.creep.travelTo(this.targetPos, options);
	}

	// Execute this task each tick. Returns nothing unless work is done.
	step(): number | void {
		if (this.creep.pos.inRangeTo(this.targetPos, this.taskData.targetRange)) {
			let workResult = this.work();
			if (workResult != OK && this.data.quiet == false) {
				this.creep.log('Error executing ' + this.name + ', returned ' + workResult);
			}
			return workResult;
		} else {
			this.move();
		}
	}

	// Task to perform when at the target
	abstract work(): number;
}

import profiler = require('../lib/screeps-profiler');
profiler.registerClass(Task, 'Task');
