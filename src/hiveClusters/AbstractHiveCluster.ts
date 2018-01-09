/* Generalized class for a base component */

export abstract class AbstractHiveCluster implements IHiveCluster {
	// colonyName: string; 	// Name of the colony
	colony: IColony;
	room: Room;				// Room of the baseComponent (not necessarily colony room)
	pos: RoomPosition; 		// Position of the instantiation object
	componentName: string; 	// Name of the component (e.g. "hatchery")
	name: string;			// Unique identifier for the instance of the hive cluster
	memory: any;
	// overlords: { [name: string]: IOverlord };
	overlord: IOverlord | undefined;

	constructor(colony: IColony, instantiationObject: RoomObject, name: string) {
		// Set up hatchery, register colony and memory
		this.colony = colony;
		// this.colonyName = colony.name;
		this.room = instantiationObject.room!;
		this.pos = instantiationObject.pos;
		this.componentName = name;
		this.name = name + ':' + instantiationObject.ref;
		// this.overlords = {};
	}

	protected initMemory(memory: any, memName: string, memoryToWrite = {}) {
		if (!memory[memName]) {
			memory[memName] = memoryToWrite;
		}
		this.memory = memory[memName];
	}

	//
	// // Reference to the colony overseer - must be used as a getter to reference fully initialized overseer
	// get overlord(): IOverseer {
	// 	return Overmind.Overseers[this.colonyName];
	// }

	// // Reference to the colony object
	// get colony(): IColony {
	// 	return Overmind.Colonies[this.colonyName];
	// }

	// // Logic for requesting creeps from the hatchery. These are called at the end of the init() phase
	// protected abstract registerCreepRequests(): void;

	// Pre-run logic, such as registering objectives
	abstract init(): void;

	// Runtime logic, such as controlling creep actions
	abstract run(): void;

}

