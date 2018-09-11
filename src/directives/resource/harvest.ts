import {Directive} from '../Directive';
import {MiningOverlord} from '../../overlords/mining/miner';
import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../../utilities/Cartographer';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {rollingAverage} from '../../utilities/utils';


interface DirectiveHarvestMemory extends FlagMemory {
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

	// source: Source | undefined;
	// mineral: Mineral | undefined;
	// extractor: StructureExtractor | undefined;
	// container: StructureContainer | undefined;
	// link: StructureLink | undefined;
	// constructionSite: ConstructionSite | undefined;

	constructor(flag: Flag) {
		super(flag);
		if (this.colony) {
			this.colony.miningSites[this.name] = this;
			this.colony.destinations.push(this.pos);
		}
		_.defaultsDeep(this.memory, defaultDirectiveHarvestMemory);
		// this.populateData();
	}

	// private populateData() {
	// 	if (Game.rooms[this.pos.roomName]) {
	// 		this.source = _.first(this.pos.lookFor(LOOK_SOURCES));
	// 		this.mineral = _.first(this.pos.lookFor(LOOK_MINERALS));
	// 		this.extractor = this.pos.lookForStructure(STRUCTURE_EXTRACTOR) as StructureExtractor | undefined;
	// 		this.constructionSite = _.first(this.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2));
	// 		this.container = this.pos.findClosestByLimitedRange(Game.rooms[this.pos.roomName].containers, 2);
	// 		this.link = this.pos.findClosestByLimitedRange(this.colony.availableLinks, 2);
	// 		if (this.link) {
	// 			this.colony.linkNetwork.claimLink(this.link);
	// 		}
	// 	}
	// }

	// refresh() {
	// 	if (!this.room && Game.rooms[this.pos.roomName]) { // if you just gained vision of this room
	// 		this.populateData();
	// 	}
	// 	super.refresh();
	// 	$.refresh(this, 'source', 'mineral', 'extractor', 'container', 'link', 'constructionSite');
	// }

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


