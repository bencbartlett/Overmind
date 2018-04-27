import {Overlord} from '../Overlord';
import {MinerSetup} from '../../creepSetup/defaultSetups';
import {MiningSite} from '../../hiveClusters/hiveCluster_miningSite';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../priorities_overlords';
import {profile} from '../../profiler/decorator';

@profile
export class MiningOverlord extends Overlord {

	miners: Zerg[];
	miningSite: MiningSite;

	constructor(miningSite: MiningSite, priority: number) {
		super(miningSite, 'mine', priority);
		this.priority += this.outpostIndex * OverlordPriority.remoteRoom.roomIncrement;
		this.miners = this.creeps('miner');
		this.miningSite = miningSite;
	}

	init() {
		let filteredMiners = this.lifetimeFilter(this.miners);
		let miningPowerAssigned = _.sum(_.map(filteredMiners, creep => creep.getActiveBodyparts(WORK)));
		if (miningPowerAssigned < this.miningSite.miningPowerNeeded &&
			filteredMiners.length < _.filter(this.miningSite.pos.neighbors, pos => pos.isPassible()).length) {
			// Handles edge case at startup of <3 spots near mining site
			this.requestCreep(new MinerSetup());
		}
		this.creepReport(MinerSetup.role, miningPowerAssigned, this.miningSite.miningPowerNeeded);
	}

	private handleMiner(miner: Zerg): void {
		// Ensure you are in the assigned room
		if (miner.room == this.room && !miner.pos.isEdge) {
			// Harvest if out of energy
			if (miner.carry.energy == 0) {
				miner.task = Tasks.harvest(this.miningSite.source);
			}
			// Else see if there is an output to depsit to or to maintain
			else if (this.miningSite.output) {
				if (this.miningSite.output.hits < this.miningSite.output.hitsMax) {
					miner.task = Tasks.repair(this.miningSite.output);
				} else {
					miner.task = Tasks.transfer(this.miningSite.output);
				}
				// Move onto the output container if you're the only miner
				if (!miner.pos.isEqualTo(this.miningSite.output.pos) && this.miners.length == 1 &&
					this.miningSite.output instanceof StructureContainer) {
					miner.travelTo(this.miningSite.output, {range: 0});
				}
			}
			// Else build the output if there is a constructionSite (placement handled by miningSite)
			else {
				if (this.miningSite.outputConstructionSite) {
					miner.task = Tasks.build(this.miningSite.outputConstructionSite);
				}
			}
		} else {
			miner.task = Tasks.goTo(this.miningSite);
		}
	}

	run() {
		for (let miner of this.miners) {
			if (miner.isIdle) {
				this.handleMiner(miner);
			}
			miner.run();
		}
	}
}
