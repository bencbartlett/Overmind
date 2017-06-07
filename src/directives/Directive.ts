// import profiler = require('../lib/screeps-profiler');
//
// // Base class for creep tasks. Refactors creep_goTask implementation and is designed to be more extensible
// export abstract class Directive {
//
// 	name: string;
// 	ref: string;
// 	flag: Flag;
// 	room: Room;
// 	creepNames: string[];
// 	memory: any;
//
// 	constructor(name: string, flag: Flag) {
// 		// Parameters for the task
// 		this.name = name; // name of task
// 		this.flag = flag;
// 		this.room = flag.room;
// 		this.memory = flag.memory;
// 		this.ref = this.name + flag.name;
// 		this.creepNames = [];
// 	}
//
// 	get creeps(): Creep[] {
// 		return _.map(this.creepNames, name => Game.creeps[name]);
// 	}
//
// 	// Assign the task to a creep
// 	addAgent(creep: Creep): string {
// 		// register references to creep and target
// 		this.creepNames.push(creep.name);
// 		creep.memory.directive = this.ref; // serializes the searalizable portions of the task into memory
// 		return this.name;
// 	}
//
// 	// Request a creep meeting certain specifications
// 	requestCreep(requirements: (creep: Creep) => boolean): boolean {
// 		let applicableCreeps = _.filter(this.creeps, creep => requirements(creep));
// 		return false; // TODO: finish
// 	}
//
// 	// Test every tick to see if task is still valid
// 	abstract isValid(): boolean;
//
// 	abstract init(): void;
//
// 	abstract getAgents(): void;
//
// 	abstract run(): void;
//
//
// }
//
//
// profiler.registerClass(Directive, 'Directive');
