import {Colony} from '../Colony';
import {log} from '../console/log';
import {Overlord} from '../overlords/Overlord';
import {profile} from '../profiler/decorator';

/**
 * Abstract class for a hive cluster. Hive clusters group structures with related functionalities together in a
 * single cohesive object
 */
@profile
export abstract class HiveCluster {

	colony: Colony;						// Colony the cluster belongs to
	room: Room;							// Room of the baseComponent (not necessarily colony room)
	pos: RoomPosition; 					// Position of the instantiation object
	ref: string;						// Unique identifier for the cluster; can include position if multiple sites
	memory: any;						// Memory for the hive cluster; can be typecasted in child classes
	overlord: Overlord | undefined;		// Overlord (singular) for the hive cluster if there is one

	constructor(colony: Colony, instantiationObject: RoomObject, name: string) {
		this.colony = colony;
		this.room = instantiationObject.room!;
		this.pos = instantiationObject.pos;
		this.ref = name + '@' + this.colony.name;
		this.colony.hiveClusters.push(this);
	}

	get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.ref + ']</a>';
	}

	protected debug(...args: any[]) {
		if (this.memory.debug) {
			log.alert(this.print, args);
		}
	}

	// Logic to refresh the state of the hive cluster between ticks
	abstract refresh(): void;

	// Instantiate overlord(s) for the hiveCluster
	abstract spawnMoarOverlords(): void;

	// Pre-run logic, such as registering energy requests
	abstract init(): void;

	// Runtime logic, such as controlling creep actions
	abstract run(): void;

}

