// Objective - wrapper for task assignment
import {Task} from '../tasks/Task';

type targetType = RoomObject;

export abstract class Objective implements IObjective {
	name: string;
	target: targetType;
	pos: RoomPosition;
	ref: string;
	creepNames: string[];
	maxCreeps: number;
	assignableToRoles: string[];

	constructor(name: string, target: targetType) {
		this.name = name;
		this.target = target;
		this.pos = target.pos;
		this.ref = this.name + ':' + this.target.ref;
		this.creepNames = Game.cache.objectives[this.ref] || [];
		// These properties will need to be modified in child classes
		this.maxCreeps = 1;
		this.assignableToRoles = [];
	}

	abstract assignableTo(creep: ICreep): boolean;

	abstract getTask(): Task;

	assignTo(creep: ICreep): void {
		creep.memory.objectiveRef = this.ref; // give creep a reference to this objctive
		this.creepNames.push(creep.name); // register creep assignment
		creep.task = this.getTask(); // unpack task and hand it to creep
	}
}

