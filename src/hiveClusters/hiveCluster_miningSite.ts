// Mining site class for grouping relevant components

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {MiningOverlord} from '../overlords/core/overlord_mine';
import {Colony} from '../Colony';
import {Mem} from '../memory';
import {log} from '../lib/logger/log';
import {OverlordPriority} from '../overlords/priorities_overlords';
import {Visualizer} from '../visuals/Visualizer';
import {Stats} from '../stats/stats';
import {LogisticsGroup} from '../logistics/LogisticsGroup';
import {Pathing} from '../pathing/pathing';

@profile
export class MiningSite extends HiveCluster {
	source: Source;
	energyPerTick: number;
	miningPowerNeeded: number;
	output: StructureContainer | StructureLink | undefined;
	outputConstructionSite: ConstructionSite | undefined;
	// miningGroup: MiningGroup | undefined;
	overlord: MiningOverlord;

	constructor(colony: Colony, source: Source) {
		super(colony, source, 'miningSite');
		this.source = source;
		this.energyPerTick = source.energyCapacity / ENERGY_REGEN_TIME;
		this.miningPowerNeeded = Math.ceil(this.energyPerTick / HARVEST_POWER) + 1;
		// Register output method
		let siteContainer = this.pos.findClosestByLimitedRange(this.room.containers, 2);
		if (siteContainer) {
			this.output = siteContainer;
		}
		let siteLink = this.pos.findClosestByLimitedRange(this.room.links, 2);
		if (siteLink) {
			this.output = siteLink;
		}
		// Register output construction sites
		let nearbyOutputSites = this.pos.findInRange(this.room.structureSites, 2, {
			filter: (s: ConstructionSite) => s.structureType == STRUCTURE_CONTAINER ||
											 s.structureType == STRUCTURE_LINK,
		}) as ConstructionSite[];
		this.outputConstructionSite = nearbyOutputSites[0];
		// Create a mining overlord for this
		let priority = this.room.my ? OverlordPriority.ownedRoom.mine : OverlordPriority.remoteRoom.mine;
		this.overlord = new MiningOverlord(this, priority);
		if (Game.time % 100 == 0 && !this.output && !this.outputConstructionSite) {
			log.warning(`Mining site at ${this.pos.print} has no output!`);
		}
		// Calculate statistics
		this.stats();
	}

	get memory(): MiningSiteMemory {
		return Mem.wrap(this.colony.memory, this.name);
	}

	private stats() {
		let defaults = {
			usage   : 0,
			downtime: 0,
		};
		if (!this.memory.stats) this.memory.stats = defaults;
		_.defaults(this.memory.stats, defaults);
		// Compute uptime
		if (this.source.ticksToRegeneration == 1) {
			this.memory.stats.usage = (this.source.energyCapacity - this.source.energy) / this.source.energyCapacity;
		}
		this.memory.stats.downtime = (this.memory.stats.downtime * (CREEP_LIFE_TIME - 1) +
									  (this.output ? +this.output.isFull : 0)) / CREEP_LIFE_TIME;
		Stats.log(`colonies.${this.colony.name}.miningSites.${this.name}.usage`, this.memory.stats.usage);
		Stats.log(`colonies.${this.colony.name}.miningSites.${this.name}.downtime`, this.memory.stats.downtime);
	}

	/* Return the approximate predicted energy if a transporter needed to come from storage.
	 * If no storage, uses hatchery pos; if no hatchery, returns current energy */
	get approximatePredictedEnergy(): number {
		if (!(this.output && this.output instanceof StructureContainer)) {
			return 0;
		}
		let targetingTransporters = LogisticsGroup.targetingTransporters(this.output);
		let dropoffPoint = this.colony.storage ? this.colony.storage.pos :
						   this.colony.hatchery ? this.colony.hatchery.pos : undefined;
		let distance = dropoffPoint ? Pathing.distance(this.output.pos, dropoffPoint) : 0;
		let predictedSurplus = this.energyPerTick * distance;
		let outflux = _.sum(_.map(targetingTransporters, tporter => tporter.carryCapacity - _.sum(tporter.carry)));
		return Math.min(_.sum(this.output.store) + predictedSurplus - outflux, 0);
	}

	/* Register appropriate resource withdrawal requests when the output gets sufficiently full */
	private registerOutputRequests(): void {
		// Register logisticsGroup requests if approximate predicted amount exceeds transporter capacity
		if (this.output instanceof StructureContainer) {
			let transportCapacity = 200 * this.colony.level;
			// if (this.approximatePredictedEnergy > transportCapacity) {
			if (this.output.energy > 0.8 * transportCapacity) {
				this.colony.logisticsGroup.provide(this.output, {dAmountdt: this.energyPerTick});
			}
		} else if (this.output instanceof StructureLink) {
			// If the link will be full with next deposit from the miner
			let minerCapacity = 150;
			if (this.output.energy + minerCapacity > this.output.energyCapacity) {
				this.colony.linkNetwork.requestTransmit(this.output);
			}
		}
	}

	/* Initialization tasks: register resource transfer reqeusts, register creep requests */
	init(): void {
		this.registerOutputRequests();
	}

	/* Run tasks: make output construciton site if needed; build and maintain the output structure */
	run(): void {

	}

	visuals() {
		Visualizer.showInfo([`Usage:  ${this.memory.stats.usage.toPercent()}`,
							 `Uptime: ${(1 - this.memory.stats.downtime).toPercent()}`], this);
	}
}
