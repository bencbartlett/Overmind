import {Overseer} from './Overseer';
import {TaskHarvest} from '../tasks/task_harvest';
import {TaskDeposit} from '../tasks/task_deposit';
import {TaskRepair} from '../tasks/task_repair';
import {TaskBuild} from '../tasks/task_build';
import {MinerSetup} from '../creepSetup/defaultSetups';

export class MiningOverseer extends Overseer {

	miners: ICreep[];
	miningSite: IMiningSite;

	constructor(miningSite: IMiningSite) {
		super(miningSite.colony, 'mine:' + miningSite.ref);
		this.miners = this.filterCreeps('miner');
		this.miningSite = miningSite;
	}

	spawnCreeps() {
		let miningPowerAssigned = _.sum(_.map(this.miners, creep => creep.getActiveBodyparts(WORK)));
		if (miningPowerAssigned < this.miningSite.miningPowerNeeded) {
			this.requestCreep(new MinerSetup());
		}
	}

	init() {
		this.spawnCreeps();
	}

	private handleMiner(miner: ICreep): void {
		if (miner.isIdle) {
			// Ensure you are in the assigned room
			if (miner.inAssignedRoom && !miner.pos.isEdge) {
				// Harvest if out of energy
				if (miner.carry.energy == 0) {
					miner.task = new TaskHarvest(this.miningSite.source);
				}
				// Else see if there is an output to depsit to or to maintain
				else if (this.miningSite.output) {
					if (this.miningSite.output.hits < this.miningSite.output.hitsMax) {
						miner.task = new TaskRepair(this.miningSite.output);
					} else {
						miner.task = new TaskDeposit(this.miningSite.output);
					}
				}
				// Else build the output if there is a constructionSite (placement handled by miningSite)
				else {
					if (this.miningSite.outputConstructionSite) {
						miner.task = new TaskBuild(this.miningSite.outputConstructionSite);
					}
				}
			} else if (miner.assignmentPos) {
				miner.travelTo(miner.assignmentPos);
			}
		}
	}

	run() {
		for (let miner of this.miners) {
			this.handleMiner(miner);
		}
	}
}
