// Hatchery overlord: spawn and run a dedicated supplier-like hatchery attendant (called after colony has storage)
import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {log} from '../../console/log';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {hasMinerals, mergeSum, minBy} from '../../utilities/utils';
import {StoreStructure} from '../../declarations/typeGuards';
import {Colony} from '../../Colony';
import {$} from '../../caching/GlobalCache';
import {getPosFromBunkerCoord, insideBunkerBounds, quadrantFillOrder} from '../../roomPlanner/layouts/bunker';
import {TransportRequest} from '../../logistics/TransportRequestGroup';
import {Task} from '../../tasks/Task';
import {Hatchery} from '../../hiveClusters/hatchery';
import {Pathing} from '../../movement/Pathing';
import {Roles, Setups} from '../../creepSetups/setups';
import {CreepSetup} from '../../creepSetups/CreepSetup';

type SupplyStructure = StructureExtension | StructureSpawn | StructureTower | StructureLab;

function isSupplyStructure(structure: Structure): structure is SupplyStructure {
	return structure.structureType == STRUCTURE_EXTENSION
		   || structure.structureType == STRUCTURE_LAB
		   || structure.structureType == STRUCTURE_TOWER
		   || structure.structureType == STRUCTURE_SPAWN;
}

function computeQuadrant(colony: Colony, quadrant: Coord[]): SupplyStructure[] {
	let positions = _.map(quadrant, coord => getPosFromBunkerCoord(coord, colony));
	let structures: SupplyStructure[] = [];
	for (let pos of positions) {
		let structure = _.find(pos.lookFor(LOOK_STRUCTURES), s => isSupplyStructure(s)) as SupplyStructure | undefined;
		if (structure) {
			structures.push(structure);
		}
	}
	return structures;
}

@profile
export class BunkerQueenOverlord extends Overlord {

	room: Room;
	queens: Zerg[];
	queenSetup: CreepSetup;
	storeStructures: StoreStructure[];
	batteries: StructureContainer[];
	quadrants: { [quadrant: string]: SupplyStructure[] };
	private numActiveQueens: number;
	assignments: { [queenName: string]: { [id: string]: boolean } };

	constructor(hatchery: Hatchery, priority = OverlordPriority.core.queen) {
		super(hatchery, 'supply', priority);
		this.queenSetup = Setups.queens.default;
		this.queens = this.zerg(Roles.queen);
		this.batteries = _.filter(this.room.containers, container => insideBunkerBounds(container.pos, this.colony));
		this.storeStructures = _.compact([this.colony.terminal!, this.colony.storage!, ...this.batteries]);
		this.quadrants = {
			lowerRight: $.structures(this, 'LR',
									 () => computeQuadrant(this.colony, quadrantFillOrder.lowerRight)),
			upperLeft : $.structures(this, 'UL',
									 () => computeQuadrant(this.colony, quadrantFillOrder.upperLeft)),
			lowerLeft : $.structures(this, 'LL',
									 () => computeQuadrant(this.colony, quadrantFillOrder.lowerLeft)),
			upperRight: $.structures(this, 'UR',
									 () => computeQuadrant(this.colony, quadrantFillOrder.upperRight)),
		};
		this.computeQueenAssignments();
	}

	private computeQueenAssignments() {
		// Assign quadrants to queens
		this.assignments = _.zipObject(_.map(this.queens, queen => [queen.name, {}]));
		const activeQueens = _.filter(this.queens, queen => !queen.spawning);
		this.numActiveQueens = activeQueens.length;
		if (this.numActiveQueens > 0) {
			let quadrantAssignmentOrder = [this.quadrants.lowerRight,
										   this.quadrants.upperLeft,
										   this.quadrants.lowerLeft,
										   this.quadrants.upperRight];
			let i = 0;
			for (let quadrant of quadrantAssignmentOrder) {
				let queen = activeQueens[i % activeQueens.length];
				_.extend(this.assignments[queen.name], _.zipObject(_.map(quadrant, s => [s.id, true])));
				i++;
			}
		}
	}

	refresh() {
		super.refresh();
		$.refresh(this, 'batteries', 'storeStructures');
		$.refreshObject(this, 'quadrants');
		// Re-compute queen assignments if the number of queens has changed
		if (_.filter(this.queens, queen => !queen.spawning).length != this.numActiveQueens) {
			this.computeQueenAssignments();
		}
	}

	init() {
		for (let battery of this.batteries) {
			if (hasMinerals(battery.store)) { // get rid of any minerals in the container if present
				this.colony.logisticsNetwork.requestOutputMinerals(battery);
			}
		}
		const amount = this.colony.spawns.length > 1 ? 2 : 1;
		this.wishlist(amount, this.queenSetup);
	}

	// Builds a series of tasks to empty unnecessary carry contents, withdraw required resources, and supply structures
	private buildSupplyTaskManifest(queen: Zerg): Task | null {
		let tasks: Task[] = [];
		// Step 1: empty all contents (this shouldn't be necessary since queen is normally empty at this point)
		let queenPos = queen.pos;
		if (_.sum(queen.carry) > 0) {
			let transferTarget = this.colony.terminal || this.colony.storage || this.batteries[0];
			if (transferTarget) {
				tasks.push(Tasks.transferAll(transferTarget));
				queenPos = transferTarget.pos;
			} else {
				log.warning(`No transfer targets for ${queen.print}!`);
				return null;
			}
		}
		// Step 2: figure out what you need to supply for and calculate the needed resources
		let queenCarry = {} as { [resourceType: string]: number };
		let allStore = mergeSum(_.map(this.storeStructures, s => s.store));
		// let allSupplyRequests = _.compact(_.flatten(_.map(this.assignments[queen.name],
		// 												  struc => this.transportRequests.supplyByID[struc.id])));
		let supplyRequests: TransportRequest[] = [];
		for (let priority in this.colony.transportRequests.supply) {
			for (let request of this.colony.transportRequests.supply[priority]) {
				if (this.assignments[queen.name][request.target.id]) {
					supplyRequests.push(request);
				}
			}
		}
		let supplyTasks: Task[] = [];
		for (let request of supplyRequests) {
			// stop when carry will be full
			let remainingAmount = queen.carryCapacity - _.sum(queenCarry);
			if (remainingAmount == 0) break;
			// figure out how much you can withdraw
			let amount = Math.min(request.amount, remainingAmount);
			amount = Math.min(amount, allStore[request.resourceType] || 0);
			if (amount == 0) continue;
			// update the simulated carry
			if (!queenCarry[request.resourceType]) {
				queenCarry[request.resourceType] = 0;
			}
			queenCarry[request.resourceType] += amount;
			// add a task to supply the target
			supplyTasks.push(Tasks.transfer(request.target, request.resourceType, amount));
		}
		// Step 3: make withdraw tasks to get the needed resources
		let withdrawTasks: Task[] = [];
		let neededResources = _.keys(queenCarry) as ResourceConstant[];
		// TODO: a single structure doesn't need to have all resources; causes jam if labs need supply but no minerals
		let targets = _.filter(this.storeStructures,
								s => _.any(neededResources,
											resource => (s.store[resource] || 0) > 0));
		let withdrawTarget: StoreStructure | undefined;
		if (targets.length > 1) {
			withdrawTarget = minBy(targets, target => Pathing.distance(queenPos, target.pos));
		} else {
			withdrawTarget = _.first(targets);
		}
		if (!withdrawTarget) {
			log.warning(`Could not get adequate withdraw structure for ${queen.name}@${queen.pos.print}!`);
			return null;
		}
		for (let resourceType of neededResources) {
			let amount = withdrawTarget.store[resourceType];
			if(amount! >= queenCarry[resourceType]) {
				amount = queenCarry[resourceType];
			}
			withdrawTasks.push(Tasks.withdraw(withdrawTarget!, resourceType, amount))
		}
		// Step 4: put all the tasks in the correct order, set nextPos for each, and chain them together
		tasks = tasks.concat(withdrawTasks, supplyTasks);
		return Tasks.chain(tasks);
	}

	// Builds a series of tasks to withdraw required resources from targets
	private buildWithdrawTaskManifest(queen: Zerg): Task | null {
		let tasks: Task[] = [];
		let transferTarget = this.colony.terminal || this.colony.storage || this.batteries[0];
		// Step 1: empty all contents (this shouldn't be necessary since queen is normally empty at this point)
		if (_.sum(queen.carry) > 0) {
			if (transferTarget) {
				tasks.push(Tasks.transferAll(transferTarget));
			} else {
				log.warning(`No transfer targets for ${queen.print}!`);
				return null;
			}
		}
		// Step 2: figure out what you need to withdraw from
		let queenCarry = {energy: 0} as { [resourceType: string]: number };
		// let allWithdrawRequests = _.compact(_.flatten(_.map(this.assignments[queen.name],
		// 													struc => this.transportRequests.withdrawByID[struc.id])));
		let withdrawRequests: TransportRequest[] = [];
		for (let priority in this.colony.transportRequests.withdraw) {
			for (let request of this.colony.transportRequests.withdraw[priority]) {
				if (this.assignments[queen.name][request.target.id]) {
					withdrawRequests.push(request);
				}
			}
		}
		for (let request of withdrawRequests) {
			// stop when carry will be full
			let remainingAmount = queen.carryCapacity - _.sum(queenCarry);
			if (remainingAmount == 0) break;
			// figure out how much you can withdraw
			let amount = Math.min(request.amount, remainingAmount);
			if (amount == 0) continue;
			// update the simulated carry
			if (!queenCarry[request.resourceType]) {
				queenCarry[request.resourceType] = 0;
			}
			queenCarry[request.resourceType] += amount;
			// add a task to supply the target
			tasks.push(Tasks.withdraw(request.target, request.resourceType, amount));
		}
		// Step 3: put stuff in terminal/storage
		if (transferTarget) {
			tasks.push(Tasks.transferAll(transferTarget));
		} else {
			log.warning(`No transfer targets for ${queen.print}!`);
			return null;
		}
		// Step 4: return chained task manifest
		return Tasks.chain(tasks);
	}

	// private getChargingSpot(queen: Zerg): RoomPosition {
	// 	let chargeSpots = _.map(bunkerChargingSpots, coord => getPosFromBunkerCoord(coord, this.colony));
	// 	let chargeSpot = (_.first(this.assignments[queen.name]) || queen).pos.findClosestByRange(chargeSpots);
	// 	if (chargeSpot) {
	// 		return chargeSpot;
	// 	} else {
	// 		log.warning(`Could not determine charging spot for queen at ${queen.pos.print}!`);
	// 		return queen.pos;
	// 	}
	// }
	//
	// private idleActions(queen: Zerg): void {
	//
	// 	// // Refill any empty batteries
	// 	// for (let battery of this.batteries) {
	// 	// 	if (!battery.isFull) {
	// 	// 		let amount = Math.min(battery.storeCapacity - _.sum(battery.store), queen.carryCapacity);
	// 	// 		let target = this.colony.storage || this.colony.storage;
	// 	// 		if (target) {
	// 	// 			queen.task = Tasks.transfer(battery, RESOURCE_ENERGY, amount)
	// 	// 							  .fork(Tasks.withdraw(target, RESOURCE_ENERGY, amount))
	// 	// 			return;
	// 	// 		}
	// 	// 	}
	// 	// }
	//
	// 	// Go to recharging spot and get recharged
	// 	let chargingSpot = this.getChargingSpot(queen);
	// 	queen.goTo(chargingSpot, {range: 0});
	// 	// // TODO: this will cause oscillating behavior where recharge drains some energy and queen leaves to supply it
	// 	// if (queen.pos.getRangeTo(chargingSpot) == 0) {
	// 	// 	let chargingSpawn = _.first(queen.pos.findInRange(this.colony.spawns, 1));
	// 	// 	if (chargingSpawn && !chargingSpawn.spawning) {
	// 	// 		chargingSpawn.renewCreep(queen.creep);
	// 	// 	}
	// 	// }
	// }

	private handleQueen(queen: Zerg): void {
		// Does something need withdrawing?
		if (this.colony.transportRequests.needsWithdrawing &&
			_.any(_.keys(this.assignments[queen.name]), id => this.colony.transportRequests.withdrawByID[id])) {
			queen.task = this.buildWithdrawTaskManifest(queen);
		}
		// Does something need supplying?
		else if (this.colony.transportRequests.needsSupplying &&
				 _.any(_.keys(this.assignments[queen.name]), id => this.colony.transportRequests.supplyByID[id])) {
			queen.task = this.buildSupplyTaskManifest(queen);
		}
		// Otherwise do idle actions
		if (queen.isIdle) {
			// this.idleActions(queen);
			delete queen.memory._go;
		}
	}

	run() {
		this.autoRun(this.queens, queen => this.handleQueen(queen));
	}
}
