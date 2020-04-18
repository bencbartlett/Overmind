import {Pathing} from '../../movement/Pathing';
import {MiningOverlord} from '../../overlords/mining/miner';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../../utilities/Cartographer';
import {ema, getCacheExpiration} from '../../utilities/utils';
import {Directive} from '../Directive';


// Because harvest directives are the most common, they have special shortened memory keys to minimize memory impact
export const enum HARVEST_MEM {
	PATHING  = 'P',
	USAGE    = 'u',
	DOWNTIME = 'd',
}

interface DirectiveHarvestMemory extends FlagMemory {
	[HARVEST_MEM.PATHING]?: {
		[MEM.DISTANCE]: number,
		[MEM.EXPIRATION]: number
	};
	[HARVEST_MEM.USAGE]: number;
	[HARVEST_MEM.DOWNTIME]: number;
}

const defaultDirectiveHarvestMemory: DirectiveHarvestMemory = {
	[HARVEST_MEM.USAGE]   : 1,
	[HARVEST_MEM.DOWNTIME]: 0,
};

/**
 * Standard mining directive. Mines from an owned, remote, or source keeper room
 */
@profile
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
			this.colony.destinations.push({pos: this.pos, order: this.memory[MEM.TICK] || Game.time});
		}
		_.defaultsDeep(this.memory, defaultDirectiveHarvestMemory);
	}

	// Hauling distance
	get distance(): number {
		if (!this.memory[HARVEST_MEM.PATHING] || Game.time >= this.memory[HARVEST_MEM.PATHING]![MEM.EXPIRATION]) {
			const distance = Pathing.distance(this.colony.pos, this.pos) || Infinity;
			const expiration = getCacheExpiration(this.colony.storage ? 5000 : 1000);
			this.memory[HARVEST_MEM.PATHING] = {
				[MEM.DISTANCE]  : distance,
				[MEM.EXPIRATION]: expiration
			};
		}
		return this.memory[HARVEST_MEM.PATHING]![MEM.DISTANCE];
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
			this.memory[HARVEST_MEM.USAGE] = (source.energyCapacity - source.energy) / source.energyCapacity;
		}
		const container = this.overlords.mine.container;
		this.memory[HARVEST_MEM.DOWNTIME] = +(ema(container ? +container.isFull : 0,
												  this.memory[HARVEST_MEM.DOWNTIME],
												  CREEP_LIFE_TIME)).toFixed(5);
	}

}


