import {Overlord} from './Overlord';
import {TaskHarvest} from '../tasks/task_harvest';
import {TaskDeposit} from '../tasks/task_deposit';
import {TaskRepair} from '../tasks/task_repair';
import {TaskBuild} from '../tasks/task_build';
import {MinerSetup} from '../creepSetup/defaultSetups';
import {TaskGoTo} from '../tasks/task_goTo';
import {Priority} from '../config/priorities';

export class MiningOverlord extends Overlord {

	miners: Zerg[];
	miningSite: IMiningSite;

	constructor(miningSite: IMiningSite, priority = Priority.Normal) {
		super(miningSite, 'mine', priority);
		this.miners = this.creeps['miner'];
		this.miningSite = miningSite;
	}

	spawn() {
		let miningPowerAssigned = _.sum(_.map(this.lifetimeFilter(this.miners),
											  creep => creep.getActiveBodyparts(WORK)));
		if (miningPowerAssigned < this.miningSite.miningPowerNeeded) {
			this.requestCreep(new MinerSetup());
		}
	}

	init() {
		this.spawn();
	}

	private handleMiner(miner: Zerg): void {
		// Ensure you are in the assigned room
		if (miner.room == this.room && !miner.pos.isEdge) {
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
		} else {
			miner.task = new TaskGoTo(this.miningSite);
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
