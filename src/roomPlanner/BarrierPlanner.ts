import {getCutTiles} from '../algorithms/minCut';
import {getAllStructureCoordsFromLayout, RoomPlanner, translatePositions} from './RoomPlanner';
import {Colony} from '../Colony';
import {Mem} from '../Memory';
import {log} from '../console/log';
import {derefCoords} from '../utilities/utils';
import {bunkerLayout, insideBunkerBounds} from './layouts/bunker';

export interface BarrierPlannerMemory {
	barrierLookup: { [roadCoordName: string]: boolean };
}

let memoryDefaults = {
	barrierLookup: {},
};

export class BarrierPlanner {

	roomPlanner: RoomPlanner;
	colony: Colony;
	barrierPositions: RoomPosition[];

	static settings = {
		buildBarriersAtRCL: 3,
		padding           : 3, // allow this much space between structures and barriers
		bunkerizeRCL      : 7
	};

	constructor(roomPlanner: RoomPlanner) {
		this.roomPlanner = roomPlanner;
		this.colony = roomPlanner.colony;
		this.barrierPositions = [];
	}

	get memory(): BarrierPlannerMemory {
		return Mem.wrap(this.colony.memory, 'barrierPlanner', memoryDefaults);
	}

	private computeBunkerBarrierPositions(bunkerPos: RoomPosition, upgradeSitePos: RoomPosition): RoomPosition[] {
		let rectArray = [];
		let padding = BarrierPlanner.settings.padding;
		if (bunkerPos) {
			let {x, y} = bunkerPos;
			let [x1, y1] = [Math.max(x - 5 - padding, 0), Math.max(y - 5 - padding, 0)];
			let [x2, y2] = [Math.min(x + 5 + padding, 49), Math.min(y + 5 + padding, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		if (upgradeSitePos) {
			let {x, y} = upgradeSitePos;
			let [x1, y1] = [Math.max(x - 1, 0), Math.max(y - 1, 0)];
			let [x2, y2] = [Math.min(x + 1, 49), Math.min(y + 1, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		// Get Min cut
		let barrierCoords = getCutTiles(this.colony.name, rectArray, false, 2, false);
		return _.map(barrierCoords, coord => new RoomPosition(coord.x, coord.y, this.colony.name));
	}

	private computeBarrierPositions(hatcheryPos: RoomPosition, commandCenterPos: RoomPosition,
									upgradeSitePos: RoomPosition): RoomPosition[] {
		let rectArray = [];
		let padding = BarrierPlanner.settings.padding;
		if (hatcheryPos) {
			let {x, y} = hatcheryPos;
			let [x1, y1] = [Math.max(x - 5 - padding, 0), Math.max(y - 4 - padding, 0)];
			let [x2, y2] = [Math.min(x + 5 + padding, 49), Math.min(y + 6 + padding, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		if (commandCenterPos) {
			let {x, y} = commandCenterPos;
			let [x1, y1] = [Math.max(x - 3 - padding, 0), Math.max(y - 0 - padding, 0)];
			let [x2, y2] = [Math.min(x + 0 + padding, 49), Math.min(y + 5 + padding, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		if (upgradeSitePos) {
			let {x, y} = upgradeSitePos;
			let [x1, y1] = [Math.max(x - 1, 0), Math.max(y - 1, 0)];
			let [x2, y2] = [Math.min(x + 1, 49), Math.min(y + 1, 49)];
			rectArray.push({x1: x1, y1: y1, x2: x2, y2: y2});
		}
		// Get Min cut
		let barrierCoords = getCutTiles(this.colony.name, rectArray, true, 2, false);
		return _.map(barrierCoords, coord => new RoomPosition(coord.x, coord.y, this.colony.name));
	}

	init(): void {

	}

	/* Write everything to memory after roomPlanner is closed */
	finalize(): void {
		this.memory.barrierLookup = {};
		if (this.barrierPositions.length == 0) {
			if (this.roomPlanner.storagePos && this.roomPlanner.hatcheryPos) {
				this.barrierPositions = this.computeBarrierPositions(this.roomPlanner.hatcheryPos,
																	 this.roomPlanner.storagePos,
																	 this.colony.controller.pos);
			} else {
				log.error(`Couldn't generate barrier plan for ${this.colony.name}!`);
			}
		}
		for (let pos of this.barrierPositions) {
			this.memory.barrierLookup[pos.coordName] = true;
		}
	}

	/* Quick lookup for if a barrier should be in this position. Barriers returning false won't be maintained. */
	barrierShouldBeHere(pos: RoomPosition): boolean {
		if (this.colony.layout == 'bunker') {
			if (this.colony.level >= BarrierPlanner.settings.bunkerizeRCL) {
				// Once you are high level, only maintain ramparts at bunker or controller
				return insideBunkerBounds(pos, this.colony) || pos.getRangeTo(this.colony.controller) <= 2;
			} else {
				// Otherwise keep the normal plan up
				return this.memory.barrierLookup[pos.coordName];
			}
		} else {
			return this.memory.barrierLookup[pos.coordName];
		}
	}

	/* Create construction sites for any buildings that need to be built */
	private buildMissingRamparts(): void {
		// Max buildings that can be placed each tick
		let count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;
		// Build missing ramparts
		let barrierPositions = [];
		for (let coord of _.keys(this.memory.barrierLookup)) {
			barrierPositions.push(derefCoords(coord, this.colony.name));
		}
		for (let pos of barrierPositions) {
			if (count > 0 && RoomPlanner.canBuild(STRUCTURE_RAMPART, pos) && this.barrierShouldBeHere(pos)) {
				let ret = pos.createConstructionSite(STRUCTURE_RAMPART);
				if (ret != OK) {
					log.warning(`${this.colony.name}: couldn't create rampart site at ${pos.print}. Result: ${ret}`);
				} else {
					count--;
				}
			}
		}
	}

	private buildMissingBunkerRamparts(): void {
		if (!this.roomPlanner.bunkerPos) return;
		let bunkerCoords = getAllStructureCoordsFromLayout(bunkerLayout, this.colony.level);
		let bunkerPositions = _.map(bunkerCoords, coord => new RoomPosition(coord.x, coord.y, this.colony.name));
		bunkerPositions = translatePositions(bunkerPositions, bunkerLayout.data.anchor, this.roomPlanner.bunkerPos);
		let count = RoomPlanner.settings.maxSitesPerColony - this.colony.constructionSites.length;
		for (let pos of bunkerPositions) {
			if (count > 0 && !pos.lookForStructure(STRUCTURE_RAMPART)
				&& pos.lookFor(LOOK_CONSTRUCTION_SITES).length == 0) {
				let ret = pos.createConstructionSite(STRUCTURE_RAMPART);
				if (ret != OK) {
					log.warning(`${this.colony.name}: couldn't create bunker rampart at ${pos.print}. Result: ${ret}`);
				} else {
					count--;
				}
			}
		}
	}

	run(): void {
		if (this.roomPlanner.active) {
			if (this.roomPlanner.bunkerPos) {
				this.barrierPositions = this.computeBunkerBarrierPositions(this.roomPlanner.bunkerPos,
																		   this.colony.controller.pos);
			} else if (this.roomPlanner.storagePos && this.roomPlanner.hatcheryPos) {
				this.barrierPositions = this.computeBarrierPositions(this.roomPlanner.hatcheryPos,
																	 this.roomPlanner.storagePos,
																	 this.colony.controller.pos);
			}
			this.visuals();
		} else {
			if (!this.roomPlanner.memory.relocating && this.colony.level >= BarrierPlanner.settings.buildBarriersAtRCL
				&& Game.time % RoomPlanner.settings.siteCheckFrequency == this.colony.id + 1) {
				this.buildMissingRamparts();
				if (this.colony.layout == 'bunker' && this.colony.level >= 7) {
					this.buildMissingBunkerRamparts();
				}
			}
		}
	}

	visuals(): void {
		for (let pos of this.barrierPositions) {
			this.colony.room.visual.structure(pos.x, pos.y, STRUCTURE_RAMPART);
		}
	}

}