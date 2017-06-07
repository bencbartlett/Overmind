// Mining group for creating a collection of mining sites that deposit to a common location (link or storage)

import {AbstractHiveCluster} from './AbstractHiveCluster';
import {pathing} from '../pathing/pathing';


export class MiningGroup extends AbstractHiveCluster implements IMiningGroup {
	dropoff: StructureLink | StructureStorage;		// Where haulers drop off to
	backupLinks: StructureLink[] | undefined;		// Extra links they can drop off to if the first one is on cooldown
	miningSites: IMiningSite[];						// Mining sites that deposit via this mining group
	parkingSpots: RoomPosition[]; 					// Good places for haulers to idle near the dropoff
	private _haulers: ICreep[]; 					// Haulers assigned to this mining group
	data: {											// Data about the mining group, calculated once per tick
		numHaulers: number,								// Number of haulers assigned to this miningGroup
		haulingPowerSupplied: number,					// Amount of hauling supplied in units of CARRY parts
		haulingPowerNeeded: number,						// Amount of hauling needed in units of CARRY parts
		linkPowerNeeded: number,						// Amount of link power needed in units of energy/tick
		linkPowerAvailable: number,						// Amount of link power available in units of energy/tick
	};

	constructor(colony: IColony, dropoff: StructureLink | StructureStorage) {
		super(colony, dropoff, 'miningGroup');
		this.dropoff = dropoff;
		if (this.dropoff instanceof StructureLink) { // register supplementary links
			this.backupLinks = this.pos.findInRange(this.room.links, 3);
		}
		// Mining sites are populated with MiningSite instantiation
		this.miningSites = [];
	}

	get haulers(): ICreep[] {
		// Wrapper for delayed hauler reference
		if (!this._haulers) {
			this._haulers = this.dropoff.getAssignedCreeps('hauler');
		}
		return this._haulers;
	}

	private populateData(): void {
		// Supplied hauling power
		let haulingPowerSuppliedValue = _.sum(_.map(this._haulers, creep => creep.getActiveBodyparts(CARRY)));
		// Needed hauling power
		let haulingPowerNeededValue: number;
		let haulingPower = 0;
		for (let siteID in this.miningSites) {
			let site = this.miningSites[siteID];
			if (site.output instanceof StructureContainer) { // only count container mining sites
				haulingPower += site.energyPerTick * (2 * pathing.cachedPathLength(this.pos, site.pos));
			}
		}
		haulingPowerNeededValue = haulingPower / CARRY_CAPACITY;
		// Needed link power
		let linkPowerNeededValue = _.sum(_.map(this.miningSites, site => site.energyPerTick));
		// Available link power
		let linkPowerAvailableValue = 0;
		if (this.dropoff instanceof StructureLink && this.colony.storage) {
			let links: Link[] = [this.dropoff].concat(this.backupLinks!);
			linkPowerAvailableValue = _.sum(_.map(links, link => LINK_CAPACITY /
																 link.pos.getRangeTo(this.colony.storage!)));
		}
		this.data = {
			numHaulers          : this.haulers.length,
			haulingPowerSupplied: haulingPowerSuppliedValue,
			haulingPowerNeeded  : haulingPowerNeededValue,
			linkPowerNeeded     : linkPowerNeededValue,
			linkPowerAvailable  : linkPowerAvailableValue,
		};
	}

	init(): void {

	}

	run(): void {

	}
}