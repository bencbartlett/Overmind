// Mining group for creating a collection of mining sites that deposit to a common location (link or storage)

import {HiveCluster} from '../hiveClusters/HiveCluster';
import {log} from '../lib/logger/log';
import {Pathing} from '../pathing/pathing';
import {Colony} from '../Colony';
import {MiningSite} from '../hiveClusters/hiveCluster_miningSite';
import {Mem} from '../memory';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';

export class MiningGroup extends HiveCluster {
	dropoff: StructureLink | StructureStorage;		// Where haulers drop off to
	links: StructureLink[] | undefined;				// List of links contained in the mining group
	availableLinks: StructureLink[] | undefined; 	// List of links in mining group that are ready to send
	miningSites: MiningSite[];						// Mining sites that deposit via this mining group
	parkingSpots: RoomPosition[]; 					// Good places for haulers to idle near the dropoff
	transportRequests: TransportRequestGroup;			// Box for resource requests
	private settings: {								// Settings for mining group
		linksTrasmitAt: number,							// Threshold at which links will send energy
	};
	data: {											// Data about the mining group, calculated once per tick
		haulingPowerNeeded: number,						// Amount of hauling needed in units of CARRY parts
		linkPowerNeeded: number,						// Amount of link power needed in units of energy/tick
		linkPowerAvailable: number,						// Amount of link power available in units of energy/tick
	};

	// overlord: HaulingOverlord;

	constructor(colony: Colony, dropoff: StructureLink | StructureStorage) {
		super(colony, dropoff, 'miningGroup');
		this.settings = {
			linksTrasmitAt: LINK_CAPACITY - 100,
		};
		this.dropoff = dropoff;
		if (this.dropoff instanceof StructureLink) { // register supplementary links
			this.links = this.pos.findInRange(colony.dropoffLinks, 2);
			this.availableLinks = _.filter(this.links, link => link.cooldown == 0 &&
															   link.energy <= this.settings.linksTrasmitAt);
		}
		this.transportRequests = new TransportRequestGroup();
		// Mining sites are populated with MiningSite instantiation
		this.miningSites = [];
		// Regiser hauling overlord
		// this.overlord = new HaulingOverlord(this);
	}

	get memory() {
		return Mem.wrap(this.colony.memory, this.name);
	}

	/* Calculate needed and supplied hauling power and link transfer power for entities assigned to the mining group */
	private populateData(): void {
		// Needed hauling power
		let haulingPowerNeededValue: number;
		let haulingPower = 0;
		for (let siteID in this.miningSites) {
			let site = this.miningSites[siteID];
			if (site.output instanceof StructureContainer && site.overlord.miners.length > 0) {
				// Only count sites which have a container output and which have at least one miner present
				// (this helps in difficult "rebooting" situations)
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
			if (Game.time % 25 == 0 && linkPowerNeededValue > linkPowerAvailableValue) {
				log.info('Insufficient linking power:', linkPowerAvailableValue + '/' + linkPowerNeededValue);
			}
		}
		// Stick everything in the data object
		this.data = {
			haulingPowerNeeded: haulingPowerNeededValue,
			linkPowerNeeded   : linkPowerNeededValue,
			linkPowerAvailable: linkPowerAvailableValue,
		};
	}

	/* Register a link transfer request if the link is sufficiently full */
	private registerLinkTransferRequests(): void {
		if (this.links) {
			for (let link of this.links) {
				if (link.energy > this.settings.linksTrasmitAt) {
					this.colony.linkNetwork.requestTransmit(link);
				}
			}
		}
	}

	/* Initialization tasks: register miningSite collection objectives, register link transfer requests */
	init(): void {
		this.populateData();
		// this.registerLinkTransferRequests();
	}

	run(): void {
		return;
	}
}
