// import {Overlord} from '../Overlord';
// import {MiningSite} from '../../hiveClusters/miningSite';
// import {Zerg} from '../../zerg/Zerg';
// import {Tasks} from '../../tasks/Tasks';
// import {OverlordPriority} from '../../priorities/priorities_overlords';
// import {profile} from '../../profiler/decorator';
// import {Pathing} from '../../movement/Pathing';
// import {CreepSetup} from '../CreepSetup';
// import {Cartographer, ROOMTYPE_SOURCEKEEPER} from '../../utilities/Cartographer';
//
// export const MinerSetup = new CreepSetup('drone', {
// 	pattern  : [WORK, WORK, CARRY, MOVE],
// 	sizeLimit: 3,
// });
//
// export const SKMinerSetup = new CreepSetup('drone', {
// 	pattern  : [WORK, WORK, CARRY, MOVE],
// 	sizeLimit: 5,
// });
//
// export const MinerLongDistanceSetup = new CreepSetup('drone', {
// 	pattern  : [WORK, WORK, CARRY, MOVE, MOVE, MOVE],
// 	sizeLimit: 3,
// });
//
//
// @profile
// export class MiningOverlord extends Overlord {
//
// 	miners: Zerg[];
// 	miningSite: MiningSite;
// 	private allowDropMining: boolean;
//
// 	constructor(miningSite: MiningSite, priority: number, allowDropMining = false) {
// 		super(miningSite, 'mine', priority);
// 		this.priority += this.outpostIndex * OverlordPriority.remoteRoom.roomIncrement;
// 		this.miners = this.zerg(MinerSetup.role);
// 		this.miningSite = miningSite;
// 		this.allowDropMining = allowDropMining;
// 	}
//
// 	init() {
// 		let creepSetup = MinerSetup;
// 		if (this.colony.hatchery && Pathing.distance(this.colony.hatchery.pos, this.pos) > 50 * 3) {
// 			creepSetup = MinerLongDistanceSetup; // long distance miners
// 			// todo: this.colony.hatchery is normal hatcher for incubating once spawns[0] != undefined
// 		}
// 		if (Cartographer.roomType(this.pos.roomName) == ROOMTYPE_SOURCEKEEPER) {
// 			creepSetup = SKMinerSetup;
// 		}
// 		let filteredMiners = this.lifetimeFilter(this.miners);
// 		let miningPowerAssigned = _.sum(filteredMiners, creep => creep.getActiveBodyparts(WORK));
// 		if (miningPowerAssigned < this.miningSite.miningPowerNeeded &&
// 			filteredMiners.length < _.filter(this.miningSite.pos.neighbors, pos => pos.isWalkable()).length) {
// 			// Handles edge case at startup of <3 spots near mining site
// 			this.requestCreep(creepSetup);
// 		}
// 		this.creepReport(creepSetup.role, miningPowerAssigned, this.miningSite.miningPowerNeeded);
// 	}
//

// private harvestActions(miner: Zerg): boolean {
// 	if (_.) {
// 		if (this.directive.source) {
// 			miner.task = Tasks.harvest(this.directive.source);
// 			return true;
// 		} else {
// 			log.warning(`No source for ${this.print}!`);
// 		}
// 	}
// 	return false;
// }
//
// private repairActions(miner: Zerg): boolean {
// 	const output = this.directive.link || this.directive.container;
// 	if (output && output.hits < output.hitsMax) {
// 		miner.task = Tasks.repair(output);
// 		return true;
// 	}
// 	return false;
// }
//
// private buildActions(miner: Zerg): boolean {
// 	const outputConstructionSite = this.miningSite.findOutputConstructionSite();
// 	if (outputConstructionSite) {
// 		miner.task = Tasks.build(outputConstructionSite);
// 		if (outputConstructionSite.structureType == STRUCTURE_LINK &&
// 			miner.pos.isEqualTo(outputConstructionSite.pos)) {
// 			miner.moveOffCurrentPos(); // Move off of the contructionSite (link sites won't build)
// 		}
// 		return true;
// 	}
// }
//
// private unloadActions(miner: Zerg): boolean {
// 	const output = this.directive.link || this.directive.container;
// 	if (output) {
// 		// Move onto the output container if you're the only miner
// 		if (!miner.pos.isEqualTo(output.pos) && this.miners.length == 1
// 			&& output.structureType == STRUCTURE_CONTAINER) {
// 			miner.goTo(output, {range: 0});
// 		}
// 		miner.task = Tasks.transfer(output);
// 		return true;
// 	} else if (this.allowDropMining) {
// 		// Dropmining at early levels
// 		let nearbyDrops = miner.pos.findInRange(miner.room.droppedEnergy, 1);
// 		let dropPos = nearbyDrops.length > 0 ? _.first(nearbyDrops).pos : miner.pos;
// 		miner.task = Tasks.drop(dropPos);
// 	}
// 	return false;
// }

// 	private handleMiner(miner: Zerg): void {
// 		// Ensure you are in the assigned room
// 		if (miner.room == this.room && !miner.pos.isEdge) {
// 			// Harvest if out of energy
// 			if (miner.carry.energy == 0) {
// 				miner.task = Tasks.harvest(this.miningSite.source);
// 			}
// 			// Else see if there is an output to depsit to or to maintain
// 			else if (this.miningSite.output) {
// 				if (this.miningSite.output.hits < this.miningSite.output.hitsMax) {
// 					miner.task = Tasks.repair(this.miningSite.output);
// 				} else {
// 					miner.task = Tasks.transfer(this.miningSite.output);
// 				}
// 				// Move onto the output container if you're the only miner
// 				if (!miner.pos.isEqualTo(this.miningSite.output.pos) && this.miners.length == 1 &&
// 					this.miningSite.output instanceof StructureContainer) {
// 					miner.goTo(this.miningSite.output, {range: 0});
// 				}
// 			}
// 			// Else build the output if there is a constructionSite (placement handled by miningSite)
// 			else {
// 				const outputConstructionSite = this.miningSite.findOutputConstructionSite();
// 				if (outputConstructionSite) {
// 					miner.task = Tasks.build(outputConstructionSite);
// 					if (outputConstructionSite.structureType == STRUCTURE_LINK &&
// 						miner.pos.isEqualTo(outputConstructionSite.pos)) {
// 						// Move off of the contructionSite (link sites won't build)
// 						miner.moveOffCurrentPos();
// 					}
// 				} else if (this.allowDropMining) {
// 					// Dropmining at early levels
// 					let nearbyDrops = miner.pos.findInRange(this.room.droppedEnergy, 1);
// 					let dropPos = nearbyDrops.length > 0 ? _.first(nearbyDrops).pos : miner.pos;
// 					miner.task = Tasks.drop(dropPos);
// 				}
// 			}
// 		} else {
// 			miner.goTo(this.miningSite);
// 		}
// 	}
//
// 	run() {
// 		this.autoRun(this.miners, miner => this.handleMiner(miner),
// 					 miner => miner.flee(miner.room.fleeDefaults, {dropEnergy: true}));
// 	}
// }
