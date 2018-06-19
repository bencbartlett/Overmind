// Logistics Group: efficiently partners resource requests with transporters using a stable matching algorithm to
// provide general-purpose resource transport. For a better explanation of how this system works, see my blog post:
// https://bencbartlett.wordpress.com/2018/03/28/screeps-4-hauling-is-np-hard/

import {profile} from '../profiler/decorator';
import {Zerg} from '../Zerg';
import {log} from '../console/log';
import {Pathing} from '../movement/Pathing';
import {Colony} from '../Colony';
import {Matcher} from '../algorithms/galeShapley';
import {EnergyStructure, isEnergyStructure, isStoreStructure, StoreStructure} from '../declarations/typeGuards';
import {DirectivePickup} from '../directives/logistics/logisticsRequest';
import {Mem} from '../Memory';
import {TransporterSetup} from '../overlords/core/transporter';
import {minMax} from '../utilities/utils';

export type LogisticsTarget =
	EnergyStructure
	| StoreStructure
	| StructureLab
	| StructureNuker
	| StructurePowerSpawn
	| DirectivePickup// | Zerg;
export type BufferTarget = StructureStorage | StructureTerminal;

export interface LogisticsRequest {
	id: string;							// ID of the request; used for matching purposes
	target: LogisticsTarget;			// Target making the request
	amount: number;						// Amount to request
	dAmountdt: number;					// Optional value showing how fast it fills up / empties (e.g. mining rates)
	resourceType: ResourceConstant;		// Resource type being requested
	multiplier: number;					// Multiplier to prioritize important requests
}

interface RequestOptions {
	amount?: number;
	dAmountdt?: number;					// Always pass a positive value for this; sign is determined by function call
	resourceType?: ResourceConstant;
	multiplier?: number;
}

interface LogisticsNetworkMemory {
	transporterCache: {
		[transporterName: string]: {
			nextAvailability: [number, RoomPosition],
			predictedTransporterCarry: StoreDefinition,
			tick: number,
		}
	}
}

@profile
export class LogisticsNetwork {

	requests: LogisticsRequest[];
	transporters: Zerg[];
	buffers: BufferTarget[];
	colony: Colony;
	private targetToRequest: { [targetRef: string]: number };
	private _matching: { [creepName: string]: LogisticsRequest | undefined } | undefined;
	private logisticPositions: { [roomName: string]: RoomPosition[] };
	private cache: {
		nextAvailability: { [transporterName: string]: [number, RoomPosition] },
		predictedTransporterCarry: { [transporterName: string]: StoreDefinition },
		resourceChangeRate: { [transporterName_requestID: string]: number }
	};
	static settings = {
		flagDropAmount      : 1000,
		rangeToPathHeuristic: 1.1, 	// findClosestByRange * this ~= findClosestByPos except in pathological cases
		carryThreshold      : 800, 	// only do stable matching on transporters at least this big (RCL4+)
	};

	constructor(colony: Colony) {
		this.requests = [];
		this.targetToRequest = {};
		this.colony = colony;
		this.transporters = _.filter(colony.getCreepsByRole(TransporterSetup.role),
									 creep => !creep.spawning &&
											  creep.carryCapacity >= LogisticsNetwork.settings.carryThreshold);
		this.buffers = _.compact([colony.storage!, colony.terminal!]);
		this.cache = {
			nextAvailability         : {},
			predictedTransporterCarry: {},
			resourceChangeRate       : {}
		};
		this.logisticPositions = {};
		for (let room of this.colony.rooms) {
			this.logisticPositions[room.name] = _.map([...room.storageUnits, ...room.links], s => s.pos);
		}
	}

	get memory(): LogisticsNetworkMemory {
		return Mem.wrap(this.colony.memory, 'logisticsNetwork', {
			transporterCache: {},
		});
	}

	// Request and provide functions ===================================================================================

	/* Request for resources to be deposited into this target */
	requestInput(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
			dAmountdt   : 0,
		});
		if (target.room != this.colony.room) {
			log.warning(`${target.ref} at ${target.pos.print} is outside colony room; shouldn't request!`);
		}
		if (!opts.amount) {
			opts.amount = this.getInputAmount(target, opts.resourceType!);
		}
		// Register the request
		let requestID = this.requests.length;
		let req: LogisticsRequest = {
			id          : requestID.toString(),
			target      : target,
			amount      : opts.amount,
			dAmountdt   : opts.dAmountdt!,
			resourceType: opts.resourceType!,
			multiplier  : opts.multiplier!,
		};
		this.requests.push(req);
		this.targetToRequest[req.target.ref] = requestID;
	}

	/* Request for resources to be withdrawn from this target */
	requestOutput(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
			dAmountdt   : 0,
		});
		if (!opts.amount) {
			opts.amount = this.getOutputAmount(target, opts.resourceType!);
		}
		opts.amount *= -1;
		(opts.dAmountdt!) *= -1;
		// Register the request
		let requestID = this.requests.length;
		let req: LogisticsRequest = {
			id          : requestID.toString(),
			target      : target,
			amount      : opts.amount,
			dAmountdt   : opts.dAmountdt!,
			resourceType: opts.resourceType!,
			multiplier  : opts.multiplier!,
		};
		this.requests.push(req);
		this.targetToRequest[req.target.ref] = requestID;
	}

	/* Requests output for every resourceType in a requestor object */
	requestOutputAll(target: StoreStructure | DirectivePickup, opts = {} as RequestOptions): void {
		for (let resourceType in target.store) {
			let amount = target.store[<ResourceConstant>resourceType] || 0;
			if (amount > 0) {
				opts.resourceType = <ResourceConstant>resourceType;
				this.requestOutput(target, opts);
			}
		}
	}

	/* Requests output for every mineral in a requestor object */
	requestOutputMinerals(target: StoreStructure | DirectivePickup, opts = {} as RequestOptions): void {
		for (let resourceType in target.store) {
			if (resourceType == RESOURCE_ENERGY) continue;
			let amount = target.store[<ResourceConstant>resourceType] || 0;
			if (amount > 0) {
				opts.resourceType = <ResourceConstant>resourceType;
				this.requestOutput(target, opts);
			}
		}
	}

	private getInputAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		if (target instanceof DirectivePickup) {
			return target.storeCapacity - _.sum(target.store);
		} else if (isStoreStructure(target)) {
			return target.storeCapacity - _.sum(target.store);
		} else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
			return target.energyCapacity - target.energy;
		}
		// else if (target instanceof Zerg) {
		// 	return target.carryCapacity - _.sum(target.carry);
		// }
		else {
			if (target instanceof StructureLab) {
				if (resourceType == target.mineralType) {
					return target.mineralCapacity - target.mineralAmount;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energyCapacity - target.energy;
				}
			} else if (target instanceof StructureNuker) {
				if (resourceType == RESOURCE_GHODIUM) {
					return target.ghodiumCapacity - target.ghodium;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energyCapacity - target.energy;
				}
			} else if (target instanceof StructurePowerSpawn) {
				if (resourceType == RESOURCE_POWER) {
					return target.powerCapacity - target.power;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energyCapacity - target.energy;
				}
			}
		}
		log.warning('Could not determine input amount!');
		return 0;
	}

	private getOutputAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		if (target instanceof DirectivePickup) {
			return target.store[resourceType]!;
		} else if (isStoreStructure(target)) {
			return target.store[resourceType]!;
		} else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
			return target.energy;
		}
		// else if (target instanceof Zerg) {
		// 	return target.carry[resourceType]!;
		// }
		else {
			if (target instanceof StructureLab) {
				if (resourceType == target.mineralType) {
					return target.mineralAmount;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energy;
				}
			} else if (target instanceof StructureNuker) {
				if (resourceType == RESOURCE_GHODIUM) {
					return target.ghodium;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energy;
				}
			} else if (target instanceof StructurePowerSpawn) {
				if (resourceType == RESOURCE_POWER) {
					return target.power;
				} else if (resourceType == RESOURCE_ENERGY) {
					return target.energy;
				}
			}
		}
		log.warning('Could not determine output amount!');
		return 0;
	}

	// Transporter availability and predictive functions ===============================================================

	private computeNextAvailability(transporter: Zerg): [number, RoomPosition] {
		if (transporter.task) {
			let approximateDistance = transporter.task.eta;
			let pos = transporter.pos;
			let targetPositions = transporter.task.targetPosManifest;
			// If there is a well-defined task ETA, use that as the first leg, else set dist to zero and use range
			if (approximateDistance) {
				for (let targetPos of targetPositions.slice(1)) {
					// The path lengths between any two logistics targets should be well-memorized
					approximateDistance += pos.getMultiRoomRangeTo(targetPos)
										   * LogisticsNetwork.settings.rangeToPathHeuristic;
					// approximateDistance += Pathing.distance(pos, targetPos);
					pos = targetPos;
				}
			} else {
				// This probably shouldn't happen...
				approximateDistance = 0;
				for (let targetPos of targetPositions) {
					approximateDistance += pos.getMultiRoomRangeTo(targetPos)
										   * LogisticsNetwork.settings.rangeToPathHeuristic;
					// approximateDistance += Pathing.distance(pos, targetPos);
					pos = targetPos;
				}
			}
			return [approximateDistance, pos];
		} else {
			// Report the transporter as being near a logistics target so that Pathing.distance() won't waste CPU
			let nearbyLogisticPositions = transporter.pos.findInRange(this.logisticPositions[transporter.room.name], 2);
			return [0, nearbyLogisticPositions[0] || transporter.pos];
		}
	}

	/* Number of ticks until the transporter is available and where it will be */
	private nextAvailability(transporter: Zerg): [number, RoomPosition] {
		if (!this.cache.nextAvailability[transporter.name]) {
			this.cache.nextAvailability[transporter.name] = this.computeNextAvailability(transporter);
		}
		return this.cache.nextAvailability[transporter.name];
	}

	static targetingTransporters(target: LogisticsTarget, excludedTransporter?: Zerg): Zerg[] {
		let targetingZerg = _.map(target.targetedBy, name => Game.zerg[name]);
		let targetingTransporters = _.filter(targetingZerg, zerg => zerg.roleName == TransporterSetup.role);
		if (excludedTransporter) _.remove(targetingTransporters,
										  transporter => transporter.name == excludedTransporter.name);
		return targetingTransporters;
	}

	/* Returns the predicted state of the transporter's carry after completing its current task */
	private computePredictedTransporterCarry(transporter: Zerg,
											 nextAvailability?: [number, RoomPosition]): StoreDefinition {
		if (transporter.task && transporter.task.target) {
			let requestID = this.targetToRequest[transporter.task.target.ref];
			if (requestID) {
				let request = this.requests[requestID];
				if (request) {
					let carry = transporter.carry;
					let remainingCapacity = transporter.carryCapacity - _.sum(carry);
					let resourceAmount = -1 * this.predictedRequestAmount(transporter, request, nextAvailability);
					// ^ need to multiply amount by -1 since transporter is doing complement of what request needs
					if (carry[request.resourceType]) {
						carry[request.resourceType]! += resourceAmount;
						carry[request.resourceType] = minMax(carry[request.resourceType]!, 0, remainingCapacity);
					} else {
						carry[request.resourceType] = minMax(resourceAmount, 0, remainingCapacity);
					}
					return carry;
				}
			}
		}
		return transporter.carry;
	}

	/* Returns the predicted state of the transporter's carry after completing its task */
	private predictedTransporterCarry(transporter: Zerg): StoreDefinition {
		if (!this.cache.predictedTransporterCarry[transporter.name]) {
			this.cache.predictedTransporterCarry[transporter.name] = this.computePredictedTransporterCarry(transporter);
		}
		return this.cache.predictedTransporterCarry[transporter.name];
	}

	/* Returns the effective amount that a transporter will see upon arrival, accounting for other targeting creeps */
	predictedRequestAmount(transporter: Zerg, request: LogisticsRequest,
						   nextAvailability?: [number, RoomPosition]): number {
		// Figure out when/where the transporter will be free
		let busyUntil: number;
		let newPos: RoomPosition;
		if (!nextAvailability) {
			[busyUntil, newPos] = this.nextAvailability(transporter);
		} else {
			[busyUntil, newPos] = nextAvailability;
		}
		// let eta = busyUntil + Pathing.distance(newPos, request.target.pos);
		let eta = busyUntil + LogisticsNetwork.settings.rangeToPathHeuristic *
				  newPos.getMultiRoomRangeTo(request.target.pos);
		let predictedDifference = request.dAmountdt * eta; // dAmountdt has same sign as amount
		// Account for other transporters targeting the target
		let otherTargetingTransporters = LogisticsNetwork.targetingTransporters(request.target, transporter);
		// let closerTargetingTransporters = _.filter(otherTargetingTransporters,
		// 										   transporter => this.nextAvailability(transporter)[0] < eta);
		if (request.amount > 0) { // requester state, energy in
			let resourceInflux = _.sum(_.map(otherTargetingTransporters,
											 other => (other.carry[request.resourceType] || 0)));
			let predictedAmount = Math.max(request.amount + predictedDifference - resourceInflux, 0);
			if (isStoreStructure(<Structure>request.target)) { 	// cap predicted amount at storeCapacity
				predictedAmount = Math.min(predictedAmount, (<StoreStructure>request.target).storeCapacity);
			}
			return predictedAmount;
		} else { // output state, energy out
			let resourceOutflux = _.sum(_.map(otherTargetingTransporters,
											  other => other.carryCapacity - _.sum(other.carry)));
			let predictedAmount = Math.min(request.amount + predictedDifference + resourceOutflux, 0);
			if (isStoreStructure(<Structure>request.target)) { 	// cap predicted amount at -1 * storeCapacity
				predictedAmount = Math.max(predictedAmount, -1 * (<StoreStructure>request.target).storeCapacity);
			}
			return predictedAmount;
		}
	}

	// Functions for computing resource change rate ====================================================================

	/* Consider all possibilities of buffer structures to visit on the way to fulfilling the request */
	bufferChoices(transporter: Zerg, request: LogisticsRequest): {
		dQ: number,			// Absolute value of amount of resource transported with the choice
		dt: number,			// Amount of time to execute the choice
		targetRef: string	// Reference of the immediate target
	}[] {
		let [ticksUntilFree, newPos] = this.nextAvailability(transporter);
		let choices: { dQ: number, dt: number, targetRef: string }[] = [];
		let amount = this.predictedRequestAmount(transporter, request, [ticksUntilFree, newPos]);
		let carry: StoreDefinition;
		if (!transporter.task || transporter.task.target != request.target) {
			// If you are not targeting the requestor, use predicted carry after completing current task
			carry = this.predictedTransporterCarry(transporter);
		} else {
			// If you are targeting the requestor, use current carry for computations
			carry = transporter.carry;
		}
		if (amount > 0) { // requestInput instance, needs refilling
			// Change in resources if transporter goes straight to the input
			let dQ_direct = Math.min(amount, carry[request.resourceType] || 0);
			// let dt_direct = Pathing.distance(newPos, request.target.pos) + ticksUntilFree;
			let dt_direct = ticksUntilFree + newPos.getMultiRoomRangeTo(request.target.pos) * LogisticsNetwork.settings.rangeToPathHeuristic;
			choices.push({
							 dQ       : dQ_direct,
							 dt       : dt_direct,
							 targetRef: request.target.ref
						 });
			if ((carry[request.resourceType] || 0) > amount || _.sum(carry) == transporter.carryCapacity) {
				return choices; // Return early if you already have enough resources to go direct or are already full
			}
			// Change in resources if transporter picks up resources from a buffer first
			for (let buffer of this.buffers) {
				let dQ_buffer = Math.min(amount, transporter.carryCapacity, buffer.store[request.resourceType] || 0);
				let dt_buffer = newPos.getMultiRoomRangeTo(request.target.pos) * LogisticsNetwork.settings.rangeToPathHeuristic + // Pathing.distance(newPos, buffer.pos) +
								Pathing.distance(buffer.pos, request.target.pos) + ticksUntilFree;
				choices.push({
								 dQ       : dQ_buffer,
								 dt       : dt_buffer,
								 targetRef: buffer.ref
							 });
			}
		} else if (amount < 0) { // requestOutput instance, needs pickup
			// Change in resources if transporter goes straight to the output
			let remainingCarryCapacity = transporter.carryCapacity - _.sum(carry);
			let dQ_direct = Math.min(Math.abs(amount), remainingCarryCapacity);
			let dt_direct = newPos.getMultiRoomRangeTo(request.target.pos) * LogisticsNetwork.settings.rangeToPathHeuristic + //Pathing.distance(newPos, request.target.pos)
							+ticksUntilFree;
			choices.push({
							 dQ       : dQ_direct,
							 dt       : dt_direct,
							 targetRef: request.target.ref
						 });
			if (remainingCarryCapacity >= Math.abs(amount) || remainingCarryCapacity == transporter.carryCapacity) {
				return choices; // Return early you have sufficient free space or are empty
			}
			// Change in resources if transporter drops off resources at a buffer first
			for (let buffer of this.buffers) {
				let dQ_buffer = Math.min(Math.abs(amount), transporter.carryCapacity, buffer.storeCapacity - _.sum(buffer.store));
				let dt_buffer = newPos.getMultiRoomRangeTo(request.target.pos) * LogisticsNetwork.settings.rangeToPathHeuristic + //Pathing.distance(newPos, buffer.pos) +
								Pathing.distance(buffer.pos, request.target.pos) + ticksUntilFree;
				choices.push({
								 dQ       : dQ_buffer,
								 dt       : dt_buffer,
								 targetRef: buffer.ref
							 });
			}
			// if (store.resourceType == RESOURCE_ENERGY) {
			// 	// Only for when you're picking up more energy: check to see if you can put to available links
			// 	for (let link of this.colony.dropoffLinks) {
			// 		let linkDeltaResource = Math.min(Math.abs(amount), transporter.carryCapacity,
			// 			2 * link.energyCapacity);
			// 		let ticksUntilDropoff = Math.max(Pathing.distance(newPos, link.pos),
			// 										 this.colony.linkNetwork.getDropoffAvailability(link));
			// 		let linkDistance = ticksUntilDropoff +
			// 						   Pathing.distance(link.pos, store.target.pos) + ticksUntilFree;
			// 		choices.push({
			// 						 deltaResource: linkDeltaResource,
			// 						 deltaTicks   : linkDistance,
			// 						 targetRef    : link.ref
			// 					 });
			// 	}
			// }
		}
		return choices;
	}

	/* Compute the best possible value of |dResource / dt| */
	private resourceChangeRate(transporter: Zerg, request: LogisticsRequest): number {
		let key = transporter.name + ':' + request.id;
		if (!this.cache.resourceChangeRate[key]) {
			let choices = this.bufferChoices(transporter, request);
			let dQ_dt = _.map(choices, choice => request.multiplier * choice.dQ / Math.max(choice.dt, 0.1));
			this.cache.resourceChangeRate[key] = _.max(dQ_dt);
		}
		return this.cache.resourceChangeRate[key];
	}

	/* Generate requestor preferences in terms of transporters */
	requestPreferences(request: LogisticsRequest, transporters: Zerg[]): Zerg[] {
		// Requestors priortize transporters by change in resources per tick until pickup/delivery
		return _.sortBy(transporters, transporter => -1 * this.resourceChangeRate(transporter, request)); // -1 -> desc
	}

	/* Generate transporter preferences in terms of store structures */
	transporterPreferences(transporter: Zerg): LogisticsRequest[] {
		// Transporters prioritize requestors by change in resources per tick until pickup/delivery
		return _.sortBy(this.requests, request => -1 * this.resourceChangeRate(transporter, request)); // -1 -> desc
	}

	/* Logs the output of the stable matching result */
	summarizeMatching(): void {
		let requests = this.requests.slice();
		let transporters = _.filter(this.colony.getCreepsByRole(TransporterSetup.role), creep => !creep.spawning);
		let unmatchedTransporters = _.remove(transporters,
											 transporter => !_.keys(this._matching).includes(transporter.name));
		let unmatchedRequests = _.remove(requests, request => !_.values(this._matching).includes(request));
		console.log(`Stable matching for ${this.colony.name} at ${Game.time}`);
		for (let transporter of transporters) {
			let transporterStr = transporter.name + ' ' + transporter.pos;
			let request = this._matching![transporter.name]!;
			let requestStr = request.target.ref + ' ' + request.target.pos.print;
			console.log(`${transporterStr.padRight(30)} : ${requestStr}`);
		}
		for (let transporter of unmatchedTransporters) {
			let transporterStr = transporter.name + ' ' + transporter.pos;
			console.log(`${transporterStr.padRight(30)} : ${''}`);
		}
		for (let request of unmatchedRequests) {
			let requestStr = request.target.ref + ' ' + request.target.pos;
			console.log(`${''.padRight(30)} : ${requestStr}`);
		}
		console.log();
	}

	/* Logs the current state of the logistics group to the console; useful for debugging */
	summarize(): void {
		// console.log(`Summary of logistics group for ${this.colony.name} at time ${Game.time}`);
		console.log('Requests:');
		for (let request of this.requests) {
			let targetType = request.target instanceof DirectivePickup ? 'flag' :
							 request.target.structureType;
			let energy = 0;
			if (request.target instanceof DirectivePickup || isStoreStructure(request.target)) {
				energy = request.target.store[RESOURCE_ENERGY];
			} else if (isEnergyStructure(request.target)) {
				energy = request.target.energy;
			}
			let targetingTprtrNames = _.map(LogisticsNetwork.targetingTransporters(request.target), c => c.name);
			console.log(`    Target: ${targetType} ${request.target.pos.print} ${request.target.ref}    ` +
						`Amount: ${request.amount}    Energy: ${energy}    Targeted by: ${targetingTprtrNames}`);
		}
		console.log('Transporters:');
		for (let transporter of this.colony.getCreepsByRole(TransporterSetup.role)) {
			let task = transporter.task ? transporter.task.name : 'none';
			let target = transporter.task ?
						 transporter.task.proto._target.ref + ' ' + transporter.task.targetPos.print : 'none';
			let nextAvailability = this.nextAvailability(transporter);
			console.log(`    Creep: ${transporter.name}    Pos: ${transporter.pos.print}    ` +
						`Task: ${task}    Target: ${target}    ` +
						`Available in ${Math.floor(nextAvailability[0])} ticks at ${nextAvailability[1].print}`);
		}
		console.log();
	}

	get matching(): { [creepName: string]: LogisticsRequest | undefined } {
		if (!this._matching) {
			this._matching = this.stableMatching(this.transporters);
		}
		return this._matching;
	}

	/* Generate a stable matching of transporters to requests with Gale-Shapley algorithm */
	private stableMatching(transporters: Zerg[]): { [creepName: string]: LogisticsRequest | undefined } {
		let tPrefs: { [transporterName: string]: string[] } = {};
		for (let transporter of transporters) {
			tPrefs[transporter.name] = _.map(this.transporterPreferences(transporter), request => request.id);
		}
		let rPrefs: { [requestID: string]: string[] } = {};
		for (let request of this.requests) {
			rPrefs[request.id] = _.map(this.requestPreferences(request, transporters), transporter => transporter.name);
		}
		let stableMatching = new Matcher(tPrefs, rPrefs).match();
		let requestMatch = _.mapValues(stableMatching, reqID => _.find(this.requests, request => request.id == reqID));
		return requestMatch;
	}

}

