// Mining group for creating a collection of mining sites that deposit to a common location (link or storage)

import {AbstractHiveCluster} from './AbstractHiveCluster';
import {log} from '../lib/logger/log';
import {TransportRequestGroup} from '../resourceRequests/TransportRequestGroup';
import {profile} from '../lib/Profiler';
import {Pathing} from '../pathing/pathing';
import {HaulingOverlord} from '../overlords/overlord_haul';

@profile
export class MiningGroup extends AbstractHiveCluster implements IMiningGroup {
	memory: any;
	dropoff: StructureLink | StructureStorage;		// Where haulers drop off to
	links: StructureLink[] | undefined;				// List of links contained in the mining group
	availableLinks: StructureLink[] | undefined; 	// List of links in mining group that are ready to send
	miningSites: IMiningSite[];						// Mining sites that deposit via this mining group
	parkingSpots: RoomPosition[]; 					// Good places for haulers to idle near the dropoff
	// private objectivePriorities: string[]; 			// Prioritization for objectives in the objective group
	transportRequests: TransportRequestGroup;			// Box for resource requests
	// objectiveGroup: ObjectiveGroup; 				// Box for objectives assigned to this mining group
	// private _haulers: Zerg[]; 					// Haulers assigned to this mining group
	private settings: {								// Settings for mining group
		linksTrasmitAt: number,							// Threshold at which links will send energy
	};
	data: {											// Data about the mining group, calculated once per tick
		// numHaulers: number,								// Number of haulers assigned to this miningGroup
		// haulingPowerSupplied: number,					// Amount of hauling supplied in units of CARRY parts
		haulingPowerNeeded: number,						// Amount of hauling needed in units of CARRY parts
		linkPowerNeeded: number,						// Amount of link power needed in units of energy/tick
		linkPowerAvailable: number,						// Amount of link power available in units of energy/tick
	};
	overlord: IOverlord;

	constructor(colony: IColony, dropoff: StructureLink | StructureStorage) {
		super(colony, dropoff, 'miningGroup');
		this.initMemory(colony.memory, this.name);
		this.settings = {
			linksTrasmitAt: LINK_CAPACITY - 100,
		};
		this.dropoff = dropoff;
		if (this.dropoff instanceof StructureLink) { // register supplementary links
			this.links = this.pos.findInRange(colony.unclaimedLinks, 2);
			this.availableLinks = _.filter(this.links, link => link.cooldown == 0 &&
															   link.energy <= this.settings.linksTrasmitAt);
		}
		// Instantiate objective group and resource requests
		// this.objectivePriorities = [
		// 	'collectEnergyMiningSite',
		// ];
		// this.objectiveGroup = new ObjectiveGroup(this.objectivePriorities);
		this.transportRequests = new TransportRequestGroup();
		// Mining sites are populated with MiningSite instantiation
		this.miningSites = [];
		// Regiser hauling overlord
		this.overlord = new HaulingOverlord(this);
	}

	// get haulers(): Zerg[] {
	// 	// Wrapper for delayed hauler reference
	// 	if (!this._haulers) {
	// 		this._haulers = this.dropoff.getAssignedCreeps('hauler');
	// 	}
	// 	return this._haulers;
	// }

	/* Calculate needed and supplied hauling power and link transfer power for entities assigned to the mining group */
	private populateData(): void {
		// Supplied hauling power
		// let haulingPowerSuppliedValue = _.sum(_.map(this.haulers, creep => creep.getActiveBodyparts(CARRY)));
		// Needed hauling power
		let haulingPowerNeededValue: number;
		let haulingPower = 0;
		for (let siteID in this.miningSites) {
			let site = this.miningSites[siteID];
			if (site.output instanceof StructureContainer) { // only count container mining sites
				haulingPower += site.energyPerTick * (2 * Pathing.weightedDistance(this.pos, site.pos));
			}
		}
		haulingPowerNeededValue = haulingPower / CARRY_CAPACITY;
		// Compute link power requirements
		let linkPowerNeededValue = 0;
		let linkPowerAvailableValue = 0;
		if (this.dropoff instanceof StructureLink && this.colony.storage) {
			linkPowerNeededValue = _.sum(_.map(this.miningSites, site => site.energyPerTick));
			linkPowerAvailableValue = _.sum(_.map(this.links!, link => LINK_CAPACITY /
																	   link.pos.getRangeTo(this.colony.storage!)));
			if (linkPowerNeededValue > linkPowerAvailableValue) {
				log.info('Insufficient linking power:', linkPowerAvailableValue + '/' + linkPowerNeededValue);
			}
		}
		// Stick everything in the data object
		this.data = {
			// numHaulers          : this.haulers.length,
			// haulingPowerSupplied: haulingPowerSuppliedValue,
			haulingPowerNeeded  : haulingPowerNeededValue,
			linkPowerNeeded     : linkPowerNeededValue,
			linkPowerAvailable  : linkPowerAvailableValue,
		};
	}

	// /* Register hauler collection objectives across the assigned mining sites */
	// private registerObjectives(): void {
	// 	// Create an energy collection objective for each relevant withdrawal request
	// 	let withdrawContainers = _.map(this.transportRequests.withdraw.haul,
	// 								   request => request.target) as StructureContainer[];
	// 	let collectionObjectives = _.map(withdrawContainers, cont => new ObjectiveCollectEnergyMiningSite(cont));
	// 	// Register the objectives to the objective group
	// 	this.objectiveGroup.registerObjectives(collectionObjectives);
	// }

	/* Register a link transfer request if the link is sufficiently full */
	private registerLinkTransferRequests(): void {
		if (this.links) {
			for (let link of this.links) {
				if (link.energy > this.settings.linksTrasmitAt) {
					this.colony.transportRequests.requestWithdrawal(link);
				}
			}
		}
	}

	// /* Request a hauler if there is insufficient available hauling power */
	// protected registerCreepRequests(): void {
	// 	if (this.data.haulingPowerSupplied < this.data.haulingPowerNeeded && this.colony.hatchery) {
	// 		this.colony.hatchery.enqueue(
	// 			new HaulerSetup().create(this.colony, {
	// 				assignment            : this.dropoff, // assign hauler to group dropoff location
	// 				patternRepetitionLimit: Infinity,
	// 			}));
	// 	}
	// }

	/* Initialization tasks: register miningSite collection objectives, register link transfer requests */
	init(): void {
		this.populateData();
		// this.registerObjectives();
		this.registerLinkTransferRequests();
		// this.registerCreepRequests();
	}

	run(): void {
		return;
	}
}
