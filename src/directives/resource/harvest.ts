import {Pathing} from '../../movement/Pathing';
import {MiningOverlord} from '../../overlords/mining/miner';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../../utilities/Cartographer';
import {exponentialMovingAverage, getCacheExpiration} from '../../utilities/utils';
import {Directive} from '../Directive';


// Because harvest directives are the most common, they have special shortened memory keys to minimize memory impact
export const _HARVEST_MEM_PATHING = 'P';
export const _HARVEST_MEM_USAGE = 'u';
export const _HARVEST_MEM_DOWNTIME = 'd';

interface DirectiveHarvestMemory extends FlagMemory {
	[_HARVEST_MEM_PATHING]?: {
		[_MEM.DISTANCE]: number,
		[_MEM.EXPIRATION]: number
	};
	[_HARVEST_MEM_USAGE]: number;
	[_HARVEST_MEM_DOWNTIME]: number;
}

const defaultDirectiveHarvestMemory: DirectiveHarvestMemory = {
	[_HARVEST_MEM_USAGE]   : 1,
	[_HARVEST_MEM_DOWNTIME]: 0,
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
			this.colony.destinations.push({pos: this.pos, order: this.memory[_MEM.TICK] || Game.time});
		}
		_.defaultsDeep(this.memory, defaultDirectiveHarvestMemory);
	}

	// Hauling distance
	get distance(): number {
		if (!this.memory[_HARVEST_MEM_PATHING] || Game.time >= this.memory[_HARVEST_MEM_PATHING]![_MEM.EXPIRATION]) {
			const distance = Pathing.distance(this.colony.pos, this.pos);
			const expiration = getCacheExpiration(this.colony.storage ? 5000 : 1000);
			this.memory[_HARVEST_MEM_PATHING] = {
				[_MEM.DISTANCE]  : distance,
				[_MEM.EXPIRATION]: expiration
			};
		}
		return this.memory[_HARVEST_MEM_PATHING]![_MEM.DISTANCE];
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
			this.memory[_HARVEST_MEM_USAGE] = (source.energyCapacity - source.energy) / source.energyCapacity;
		}
		const container = this.overlords.mine.container;
		this.memory[_HARVEST_MEM_DOWNTIME] = +(exponentialMovingAverage(container ? +container.isFull : 0,
																		this.memory[_HARVEST_MEM_DOWNTIME],
																		CREEP_LIFE_TIME)).toFixed(5);
	}

}


