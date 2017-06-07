// Mining site class for grouping relevant components

import {AbstractHiveCluster} from './AbstractHiveCluster';
import {TaskBuild} from '../tasks/task_build';
import {TaskRepair} from '../tasks/task_repair';

export class MiningSite extends AbstractHiveCluster implements IMiningSite {
	source: Source;
	energyPerTick: number;
	miningPowerNeeded: number;
	output: StructureContainer | StructureLink | undefined;
	outputConstructionSite: ConstructionSite | undefined;
	private _miners: ICreep[];

	constructor(colony: IColony, source: Source) {
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
	}

	get miners(): ICreep[] {
		// Wrapper for miner reference that avoids the Game.icreeps requires Colonies requires Game.icreeps issue
		if (!this._miners) {
			this._miners = this.source.getAssignedCreeps('miner');
		}
		return this._miners;
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

	init(): void {
		// Handle energy output
		if (this.output instanceof StructureContainer) {
			let avgHaulerCap = CARRY_CAPACITY * this.colony.data.haulingPowerSupplied / this.colony.data.numHaulers;
			if (this.predictedStore > 0.75 * avgHaulerCap) { // TODO: add path length dependence
				this.overlord.resourceRequests.registerWithdrawalRequest(this.output);
			}
		} else if (this.output instanceof StructureLink) {
			// If the link will be full with next deposit from the miner
			let minerCapacity = 150; // hardcoded value, I know, but saves import time
			if (this.output.energy + minerCapacity > this.output.energyCapacity) {
				let linkRequest = this.overlord.resourceRequests.resourceIn.link.shift();
				if (linkRequest) {
					let targetLink = linkRequest.target as Link;
					this.output.transferEnergy(targetLink);
				} else if (this.colony.commandCenter && this.colony.commandCenter.link) {
					this.output.transferEnergy(this.colony.commandCenter.link);
				}
			}
		}
	}

	run(): void {
		// Make a construction site for an output if needed
		if (!this.output && !this.outputConstructionSite) {
			// Miners only get energy from harvesting, so miners with >0 energy are in position; build output there
			let minerInPosition = _.filter(this.miners, miner => miner.carry.energy > 0)[0];
			if (minerInPosition) {
				this.room.createConstructionSite(minerInPosition.pos, STRUCTURE_CONTAINER);
				return; // This guarantees that there is either an output or a construction site past this eval point
			}
		}
		// Build and maintain the output
		for (let miner of this.miners) {
			if (miner.carry.energy > 0) {
				if (this.output) {
					if (this.output.hits < this.output.hitsMax) {
						miner.task = new TaskRepair(this.output);
					}
				} else {
					if (this.outputConstructionSite) {
						miner.task = new TaskBuild(this.outputConstructionSite);
					}
				}
			}
		}
	}
}

