// // Creep properties ====================================================================================================
//
// Creep.prototype.getBodyparts = function (partType) {
// 	return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
// };
//
//
// Object.defineProperty(Creep.prototype, 'colony', { // retrieve the colony object of the creep
// 	get: function () {
// 		return Overmind.Colonies[this.memory.colony];
// 	},
// 	set: function (newColony) {
// 		this.memory.colony = newColony.name;
// 	}
// });
//
// Object.defineProperty(Creep.prototype, 'lifetime', { // creep lifetime; 1500 unless claimer, then 500
// 	get: function () {
// 		if (_.map(this.body, (part: BodyPartDefinition) => part.type).includes(CLAIM)) {
// 			return 500;
// 		} else {
// 			return 1500;
// 		}
// 	},
// });
//
// // Object.defineProperty(Creep.prototype, 'task', {
// // 	/* Wrapper for _task */
// // 	get(): ITask | null {
// // 		if (!this._task) {
// // 			let protoTask = this.memory.task as protoTask;
// // 			if (protoTask) {
// // 				// PERFORM TASK MIGRATION HERE
// // 				this._task = taskFromPrototask(protoTask);
// // 			} else {
// // 				this._task = null;
// // 			}
// // 		}
// // 		return this._task;
// // 	},
// //
// // 	/* Assign the creep a task with the setter, replacing creep.assign(Task) */
// // 	set(task: ITask | null) {
// // 		// Unregister target from old task if applicable
// // 		let oldProtoTask = this.memory.task as protoTask;
// // 		if (oldProtoTask) {
// // 			let oldRef = oldProtoTask._target.ref;
// // 			if (Overmind.cache.targets[oldRef]) {
// // 				Overmind.cache.targets[oldRef] = _.remove(Overmind.cache.targets[oldRef], name => name == this.name);
// // 			}
// // 		}
// // 		// Set the new task
// // 		this.memory.task = task;
// // 		if (task && task.target) { // If task isn't null
// // 			// Register task target in cache
// // 			if (!Overmind.cache.targets[task.target.ref]) {
// // 				Overmind.cache.targets[task.target.ref] = [];
// // 			}
// // 			Overmind.cache.targets[task.target.ref].push(this.name);
// // 			// Register references to creep
// // 			task.creep = this;
// // 			this._task = task;
// // 		}
// // 	}
// // });
