/* Generalized class for a base component */

import {Colony} from '../Colony';
import {Overlord} from '../overlords/Overlord';

export abstract class HiveCluster {

	colony: Colony;					// Colony the cluster belongs to
	room: Room;							// Room of the baseComponent (not necessarily colony room)
	pos: RoomPosition; 					// Position of the instantiation object
	componentName: string; 				// Name of the component (e.g. "hatchery")
	name: string;						// Unique identifier for the instance of the hive cluster
	memory: any;						// Memory for the hive cluster; can be typecasted in child classes
	overlord: Overlord | undefined;	// Overlord (singular) for the hive cluster if there is one

	constructor(colony: Colony, instantiationObject: RoomObject, name: string) {
		// Set up hatchery, register colony and memory
		this.colony = colony;
		this.room = instantiationObject.room!;
		this.pos = instantiationObject.pos;
		this.componentName = name;
		this.name = name + ':' + instantiationObject.ref;
		this.colony.hiveClusters.push(this);
	}

	// protected initMemory(memory: any, memName: string, memoryToWrite = {}) {
	// 	if (!memory[memName]) {
	// 		memory[memName] = memoryToWrite;
	// 	}
	// 	this.memory = memory[memName];
	// }

	// Pre-run logic, such as registering energy requests
	abstract init(): void;

	// Runtime logic, such as controlling creep actions
	abstract run(): void;

	// Overwrite this to display relevant information
	visuals(): void {

	};
}

