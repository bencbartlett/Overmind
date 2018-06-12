// This binds a getter/setter creep.task property

import {initializeTask} from './initializer';

Object.defineProperty(Creep.prototype, 'task', {
	get() {
		if (!this._task) {
			let protoTask = this.memory.task;
			this._task = protoTask ? initializeTask(protoTask) : null;
		}
		return this._task;
	},
	set(task: ITask | null) {
		// Unregister target from old task if applicable
		let oldProtoTask = this.memory.task;
		if (oldProtoTask) {
			let oldRef = oldProtoTask._target.ref;
			if (Overmind.cache.targets[oldRef]) {
				_.remove(Overmind.cache.targets[oldRef], name => name == this.name);
			}
		}
		// Set the new task
		this.memory.task = task ? task.proto : null;
		if (task) {
			if (task.target) {
				// Register task target in cache if it is actively targeting something (excludes goTo and similar)
				if (!Overmind.cache.targets[task.target.ref]) {
					Overmind.cache.targets[task.target.ref] = [];
				}
				Overmind.cache.targets[task.target.ref].push(this.name);
			}
			// Register references to creep
			task.creep = this;
		}
		// Clear cache
		this._task = undefined;
	},
});

Creep.prototype.run = function (): void {
	if (this.task) {
		return this.task.run();
	}
};

Object.defineProperties(Creep.prototype, {
	'hasValidTask': {
		get() {
			return this.task && this.task.isValid();
		}
	},
	'isIdle'      : {
		get() {
			return !this.hasValidTask;
		}
	}
});