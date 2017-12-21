// Overseer: coordinates and directs related creep and structure actions in a more distributed manner than hive clusters

import {CreepSetup} from '../creepSetup/CreepSetup';

export abstract class Overseer {
	name: string;
	colony: IColony;
	overlord: IOverlord;
	creeps: ICreep[];
	memory: OverseerMemory;

	constructor(colony: IColony, name: string) {
		this.name = name;
		this.colony = colony;
		this.overlord = colony.overlord;
		this.creeps = colony.creepsByOverseer[this.name] || [];
		this.memory = colony.memory.overseers[this.name];
	}

	protected filterCreeps(role: string): ICreep[] {
		return _.filter(this.creeps, creep => creep.memory.role == role);
	}

	/* Generate (but not spawn) the largest creep possible, returns the protoCreep as an object */
	protected generateProtoCreep(setup: CreepSetup): protoCreep {
		// Generate the creep body
		let creepBody: BodyPartConstant[];
		if (this.colony.incubator) { // if you're being incubated, build as big a creep as you want
			creepBody = setup.generateBody(this.colony.incubator.room.energyCapacityAvailable);
		} else { // otherwise limit yourself to actual energy constraints
			creepBody = setup.generateBody(this.colony.room.energyCapacityAvailable);
		}
		// Generate the creep memory
		let creepMemory: CreepMemory = {
			colony  : this.colony.name, 						// name of the colony the creep is assigned to
			overseer: this.name,								// name of the overseer running this creep
			role    : setup.role,								// role of the creep
			task    : null, 									// task the creep is performing
			data    : { 										// rarely-changed data about the creep
				origin   : '',										// where it was spawned, filled in at spawn time
				replaceAt: 0, 										// when it should be replaced
				boosts   : {} 										// keeps track of what boosts creep has/needs
			},
			roleData: {}, 										// empty role data object
		};
		// Create the protocreep and return it
		let protoCreep: protoCreep = { 							// object to add to spawner queue
			body  : creepBody, 										// body array
			name  : setup.role, 									// name of the creep - gets modified by hatchery
			memory: creepMemory,											// memory to initialize with
		};
		return protoCreep;
	}

	/* Create a creep setup and enqueue it to the Hatchery */
	protected requestCreep(setup: CreepSetup): void {
		if (this.colony.hatchery) {
			this.colony.hatchery.enqueue(this.generateProtoCreep(setup)); // TODO: add priority
		}
	}

	abstract spawnCreeps(): void;

	abstract init(): void;

	abstract run(): void;

}