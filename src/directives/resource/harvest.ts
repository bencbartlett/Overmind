import {Directive} from '../Directive';
import {MiningOverlord} from '../../overlords/mining/miner';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../../utilities/Cartographer';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {getCacheExpiration, rollingAverage} from '../../utilities/utils';
import {Pathing} from '../../movement/Pathing';


interface DirectiveHarvestMemory extends FlagMemory {
	pathing?: {
		distance: number,
		expiration: number
	};
	stats: {
		usage: number;
		downtime: number;
	};
}

const defaultDirectiveHarvestMemory: DirectiveHarvestMemory = {
	stats: {
		usage   : 1,
		downtime: 0,
	}
};

export class DirectiveHarvest extends Directive {

	static directiveName = 'harvest';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_YELLOW;

	memory: DirectiveHarvestMemory;
	overlords: {
		mine: MiningOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
		if (this.colony) {
			this.colony.miningSites[this.name] = this;
			this.colony.destinations.push(this.pos);
		}
		_.defaultsDeep(this.memory, defaultDirectiveHarvestMemory);
	}

	// Hauling distance
	get distance(): number {
		if (!this.memory.pathing || Game.time >= this.memory.pathing.expiration) {
			let distance = Pathing.distance(this.colony.pos, this.pos);
			let expiration = getCacheExpiration(this.colony.storage ? 5000 : 1000);
			this.memory.pathing = {distance, expiration};
		}
		return this.memory.pathing.distance;
	}

	spawnMoarOverlords() {
		// Create a mining overlord for this
		let priority = OverlordPriority.ownedRoom.mine;
		if (!(this.room && this.room.my)) {
			priority = Cartographer.roomType(this.pos.roomName) == ROOMTYPE_SOURCEKEEPER ?
					   OverlordPriority.remoteSKRoom.mine : OverlordPriority.remoteRoom.mine;
		}
		this.overlords.mine = new MiningOverlord(this, priority);
	}

	init() {

	}

	run() {
		this.computeStats();
	}

	private computeStats() {
		const source = this.overlords.mine.source;
		if (source && source.ticksToRegeneration == 1) {
			this.memory.stats.usage = (source.energyCapacity - source.energy) / source.energyCapacity;
		}
		const container = this.overlords.mine.container;
		this.memory.stats.downtime = rollingAverage(container ? +container.isFull : 0,
													this.memory.stats.downtime, CREEP_LIFE_TIME);
	}

}


