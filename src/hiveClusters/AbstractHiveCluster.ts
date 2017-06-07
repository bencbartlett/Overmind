/* Generalized class for a base component */

export abstract class AbstractHiveCluster implements IHiveCluster {
	colonyName: string; 	// Name of the colony
	room: Room;				// Room of the baseComponent (not necessarily colong room)
	pos: RoomPosition; 		// Position of the instantiation object
	componentName: string; 	// Name of the component (e.g. "hatchery")

	constructor(colony: IColony, instantiationObject: RoomObject, componentName: string) {
		// Set up hatchery, register colony and memory
		this.colonyName = colony.name;
		this.room = instantiationObject.room!;
		this.pos = instantiationObject.pos;
		this.componentName = componentName;
	}

	// Reference to the colony overlord - must be used as a getter to reference fully initialized overlord
	get overlord(): IOverlord {
		return Overmind.Overlords[this.colonyName];
	}

	// Reference to the colony object
	get colony(): IColony {
		return Overmind.Colonies[this.colonyName];
	}

	log(...args: any[]): void {
		console.log(this.colonyName, ' ', this.componentName, ': "', ...args, '".');
	}

	// Pre-run logic, such as registering objectives
	abstract init(): void;

	// Runtime logic, such as controlling creep actions
	abstract run(): void;

}

