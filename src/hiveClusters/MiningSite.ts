// Mining site class for grouping relevant components

import {AbstractHiveCluster} from './AbstractHiveCluster';
import {profile} from '../lib/Profiler';
import {Pathing} from '../pathing/pathing';
import {MiningOverlord} from '../overlords/overlord_mine';
import {Priority} from '../config/priorities';
import {Colony} from '../Colony';
import {Overlord} from '../overlords/Overlord';

@profile
export class MiningSite extends AbstractHiveCluster implements IMiningSite {
	source: Source;
	energyPerTick: number;
	miningPowerNeeded: number;
	output: StructureContainer | StructureLink | undefined;
	outputConstructionSite: ConstructionSite | undefined;
	miningGroup: IMiningGroup | undefined;
	overlord: Overlord;

	// private _miners: Zerg[];

	constructor(colony: Colony, source: Source) {
		super(colony, source, 'miningSite');
		this.initMemory(colony.memory, this.name);
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
		// Register mining site with the best mining group
		let bestGroup = this.findBestMiningGroup();
		if (bestGroup) {
			this.miningGroup = bestGroup;
			bestGroup.miningSites.push(this);
		}
		// Create a mining overlord for this
		let priority = this.room.my ? Priority.High : Priority.Normal;
		this.overlord = new MiningOverlord(this, priority);
	}

	/* Predicted store amount given the number of haulers currently targeting the container */
	get predictedStore(): number {
		// This should really only be used on container sites
		if (this.output instanceof StructureContainer) {
			let targetingCreeps = _.map(this.output.targetedBy, name => Game.creeps[name]);
			// Assume all haulers are withdrawing from mining site so you don't have to scan through tasks
			let targetingHaulers = _.filter(targetingCreeps, creep => creep.memory.role == 'hauler');
			// Return storage minus the amount that currently assigned haulers will withdraw
			return _.sum(this.output.store) - _.sum(_.map(targetingHaulers,
														  hauler => hauler.carryCapacity - _.sum(hauler.carry)));
		} else if (this.output instanceof StructureLink) {
			return this.output.energy;
		} else { // if there is no output
			return 0;
		}
	}

	// get pathToDropoff(): RoomPosition[] {
	// 	// TODO: calculate path from dropoff to within range 1 of source.
	// 	// _.last(path) gives creep harvest location
	// 	//
	// }
	//
	// get outputPos(): RoomPosition {
	// 	// TODO: put output here
	// }

	/* Register appropriate resource withdrawal requests when the output gets sufficiently full */
	private registerOutputRequests(): void {
		// Figure out which request group to submit requests to
		let resourceRequestGroup: ITransportRequestGroup;
		if (this.miningGroup) {
			resourceRequestGroup = this.miningGroup.transportRequests; // TODO: bug here
		} else {
			resourceRequestGroup = this.colony.transportRequests;
		}
		// Handle energy output via resource requests
		if (this.output instanceof StructureContainer) {
			let colonyHaulers = this.colony.getCreepsByRole('hauler');
			let avgHaulerCap = _.sum(_.map(colonyHaulers, hauler => hauler.carryCapacity)) / colonyHaulers.length;
			// let avgHaulerCap = CARRY_CAPACITY * this.colony.data.haulingPowerSupplied / this.colony.data.numHaulers;
			if (this.predictedStore > 0.75 * avgHaulerCap) { // TODO: add path length dependence
				resourceRequestGroup.requestWithdrawal(this.output);
			}
		} else if (this.output instanceof StructureLink) {
			// If the link will be full with next deposit from the miner
			let minerCapacity = 150; // hardcoded value, I know, but saves import time
			if (this.output.energy + minerCapacity > this.output.energyCapacity) {
				resourceRequestGroup.requestWithdrawal(this.output);
			}
		}
	}

	private findBestMiningGroup(): IMiningGroup | undefined {
		if (this.colony.miningGroups) {
			if (this.room == this.colony.room) {
				return this.colony.miningGroups[this.colony.storage!.ref];
			} else {
				let groupsByDistance = _.sortBy(this.colony.miningGroups,
												group => Pathing.distance(this.pos, group.pos));
				return _.head(groupsByDistance);
			}
		}
	}

	/* Initialization tasks: register resource transfer reqeusts, register creep requests */
	init(): void {
		this.registerOutputRequests();
	}

	/* Run tasks: make output construciton site if needed; build and maintain the output structure */
	run(): void {
		// Make a construction site for an output if needed
		if (!this.output && !this.outputConstructionSite) {
			// // Miners only get energy from harvesting, so miners with >0 energy are in position; build output there
			// let minerInPosition = _.filter(this.miners, miner => miner.carry.energy > 0)[0];
			// if (minerInPosition) {
			//
			// 	return; // This guarantees that there is either an output or a construction site past this eval point
			// }

			// TODO:
			// this.room.createConstructionSite(minerInPosition.pos, STRUCTURE_CONTAINER);
		}
	}
}
