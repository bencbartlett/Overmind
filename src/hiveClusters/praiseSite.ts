// import {$} from '../caching/GlobalCache';
// import {Colony} from '../Colony';
// import {DirectivePraise} from '../directives/colony/praise';
// import {Mem} from '../memory/Memory';
// import {PraisingOverlord} from '../overlords/colonization/praiser';
// import {profile} from '../profiler/decorator';
// import {praiseLayout} from '../roomPlanner/layouts/praiseSite';
// import {Stats} from '../stats/stats';
// import {HiveCluster} from './_HiveCluster';
//
// interface PraiseSiteMemory {
// 	[MEM.TICK]: number;
// 	stats: { downtime: number };
// }
//
//
// /**
//  * Praise sites are specialized upgrade sites for rooms which are repeatedly unclaimed and re-leveled to gain GCL
//  */
// @profile
// export class PraiseSite extends HiveCluster {
//
// 	directive: DirectivePraise;
// 	anchor: RoomPosition;
// 	memory: PraiseSiteMemory;
//
// 	controller: StructureController;
// 	storage: StructureStorage | undefined;
// 	terminal: StructureTerminal | undefined;
// 	lab: StructureLab | undefined;
// 	ramparts: StructureRampart[];
// 	towers: StructureTower[];
//
// 	praiserPositions: RoomPosition[];
// 	overlord: PraisingOverlord;
//
// 	constructor(colony: Colony, controller: StructureController, directive: DirectivePraise) {
// 		super(colony, controller, 'upgradeSite');
// 		this.directive = directive;
// 		this.anchor = this.directive.pos;
// 		// Intiate memory
// 		this.memory = Mem.wrap(this.colony.memory, 'praiseSite');
// 		// Register structures
// 		this.controller = controller;
// 		this.storage = this.room.storage;
// 		this.terminal = this.room.terminal;
// 		this.lab = _.first(this.room.labs);
// 		this.ramparts = this.room.ramparts;
// 		this.towers = this.room.towers;
// 		// Register with parent colony
// 		this.colony.praiseSite = this;
// 		this.colony.destinations.push({pos: this.anchor, order: this.directive.memory[MEM.TICK] || Game.time});
// 		// Register upgrader positions and overlord
// 		this.praiserPositions = this.getPraiserPositions();
// 		// Compute stats
// 		this.stats();
// 	}
//
// 	private getPraiserPositions(): RoomPosition[] {
// 		const dx = this.anchor.x - praiseLayout.data.anchor.x;
// 		const dy = this.anchor.y - praiseLayout.data.anchor.y;
// 		return _.map(<Coord[]>(praiseLayout.data.pointsOfInterest!.praiserPositions),
// 					 coord => new RoomPosition(coord.x + dx, coord.y + dy, this.anchor.roomName));
// 	}
//
// 	refresh() {
// 		this.memory = Mem.wrap(this.colony.memory, 'praiseSite');
// 		$.refreshRoom(this);
// 		$.refresh(this, 'controller', 'storage', 'terminal', 'lab', 'ramparts', 'towers');
// 	}
//
// 	spawnMoarOverlords() {
// 		this.overlord = new PraisingOverlord(this);
// 	}
//
// 	init(): void {
//
// 	}
//
// 	private placeConstructionSites(): void {
//
// 	}
//
//
// 	private stats() {
// 		const defaults = {
// 			downtime: 0,
// 		};
// 		if (!this.memory.stats) this.memory.stats = defaults;
// 		_.defaults(this.memory.stats, defaults);
// 		// Compute downtime
// 		this.memory.stats.downtime = (this.memory.stats.downtime * (CREEP_LIFE_TIME - 1) +
// 									  (this.battery ? +this.battery.isEmpty : 0)) / CREEP_LIFE_TIME;
// 		Stats.log(`colonies.${this.colony.name}.upgradeSite.downtime`, this.memory.stats.downtime);
// 	}
//
// 	run(): void {
//
// 	}
//
// 	visuals() {
// 		// let info = [];
// 		// if (this.controller.level != 8) {
// 		// 	let progress = `${Math.floor(this.controller.progress / 1000)}K`;
// 		// 	let progressTotal = `${Math.floor(this.controller.progressTotal / 1000)}K`;
// 		// 	let percent = `${Math.floor(100 * this.controller.progress / this.controller.progressTotal)}`;
// 		// 	info.push(`Progress: ${progress}/${progressTotal} (${percent}%)`);
// 		//
// 		// }
// 		// info.push(`Downtime: ${this.memory.stats.downtime.toPercent()}`);
// 		// Visualizer.showInfo(info, this);
// 	}
//
// }
