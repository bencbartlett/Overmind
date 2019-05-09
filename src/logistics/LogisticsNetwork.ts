/* tslint:disable:variable-name */

import columnify from 'columnify';
import {Matcher} from '../algorithms/galeShapley';
import {Colony} from '../Colony';
import {log} from '../console/log';
import {Roles} from '../creepSetups/setups';
import {
	EnergyStructure,
	isEnergyStructure,
	isResource,
	isStoreStructure,
	isTombstone,
	StoreStructure
} from '../declarations/typeGuards';
import {Mem} from '../memory/Memory';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {minMax} from '../utilities/utils';
import {Zerg} from '../zerg/Zerg';

export type LogisticsTarget =
	EnergyStructure
	| StoreStructure
	| StructureLab
	| StructureNuker
	| StructurePowerSpawn
	| Tombstone
	| Resource;

export const ALL_RESOURCE_TYPE_ERROR =
				 `Improper logistics request: 'all' can only be used for store structure or tombstone!`;

export type BufferTarget = StructureStorage | StructureTerminal;

export interface LogisticsRequest {
	id: string;							// ID of the request; used for matching purposes
	target: LogisticsTarget;			// Target making the request
	amount: number;						// Amount to request
	dAmountdt: number;					// Optional value showing how fast it fills up / empties (e.g. mining rates)
	resourceType: ResourceConstant | 'all';		// Resource type being requested
	multiplier: number;					// Multiplier to prioritize important requests
}

interface RequestOptions {
	amount?: number;
	dAmountdt?: number;					// Always pass a positive value for this; sign is determined by function call
	resourceType?: ResourceConstant | 'all';
	multiplier?: number;
}

interface LogisticsNetworkMemory {
	transporterCache: {
		[transporterName: string]: {
			nextAvailability: [number, RoomPosition],
			predictedTransporterCarry: StoreDefinition,
			tick: number,
		}
	};
}

const LogisticsNetworkMemoryDefaults: LogisticsNetworkMemory = {
	transporterCache: {},
};

/**
 * Logistics network: efficiently partners resource requests with transporters using a stable matching algorithm to
 * provide general-purpose resource transport. For a better explanation of how this system works, see my blog post:
 * https://bencbartlett.wordpress.com/2018/03/28/screeps-4-hauling-is-np-hard/
 */
@profile
export class LogisticsNetwork {

	memory: LogisticsNetworkMemory;
	requests: LogisticsRequest[];
	// transporters: Zerg[];
	buffers: BufferTarget[];
	colony: Colony;
	private targetToRequest: { [targetRef: string]: number };
	private _matching: { [creepName: string]: LogisticsRequest | undefined } | undefined;
	// private logisticPositions: { [roomName: string]: RoomPosition[] };
	private cache: {
		nextAvailability: { [transporterName: string]: [number, RoomPosition] },
		predictedTransporterCarry: { [transporterName: string]: StoreDefinition },
		resourceChangeRate: { [requestID: string]: { [transporterName: string]: number } },
	};
	static settings = {
		flagDropAmount        : 1000,
		rangeToPathHeuristic  : 1.1, 	// findClosestByRange * this ~= findClosestByPos except in pathological cases
		carryThreshold        : 800, 	// only do stable matching on transporters at least this big (RCL4+)
		droppedEnergyThreshold: 200,	// ignore dropped energy below this amount
	};

	constructor(colony: Colony) {
		this.memory = Mem.wrap(colony.memory, 'logisticsNetwork', LogisticsNetworkMemoryDefaults);
		this.requests = [];
		this.targetToRequest = {};
		this.colony = colony;
		// this.transporters = _.filter(colony.getCreepsByRole(TransporterSetup.role),
		// 							 creep => !creep.spawning &&
		// 									  creep.carryCapacity >= LogisticsNetwork.settings.carryThreshold);
		this.buffers = _.compact([colony.storage!, colony.terminal!]);
		this.cache = {
			nextAvailability         : {},
			predictedTransporterCarry: {},
			resourceChangeRate       : {}
		};
		// this.logisticPositions = {};
		// for (let room of this.colony.rooms) {
		// 	this.logisticPositions[room.name] = _.map([...room.storageUnits, ...room.links], s => s.pos);
		// }
	}

	refresh(): void {
		this.memory = Mem.wrap(this.colony.memory, 'logisticsNetwork', LogisticsNetworkMemoryDefaults);
		this.requests = [];
		this.targetToRequest = {};
		this._matching = undefined;
		this.cache = {
			nextAvailability         : {},
			predictedTransporterCarry: {},
			resourceChangeRate       : {}
		};
	}

	// Request and provide functions ===================================================================================

	/**
	 * Request for resources to be deposited into this target
	 */
	requestInput(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
			dAmountdt   : 0,
		});
		if (target.room != this.colony.room) {
			log.warning(`${target.ref} at ${target.pos.print} is outside colony room; shouldn't request!`);
			return;
		}
		if (opts.resourceType == 'all') {
			log.warning(`Logistics request error: 'all' can only be used for output requests`);
			return;
		}
		if (!opts.amount) {
			opts.amount = this.getInputAmount(target, opts.resourceType!);
		}
		// Register the request
		const requestID = this.requests.length;
		const req: LogisticsRequest = {
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

	/**
	 * Request for resources to be withdrawn from this target
	 */
	requestOutput(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
			dAmountdt   : 0,
		});
		if (opts.resourceType == 'all' && (isStoreStructure(target) || isTombstone(target))) {
			if (_.sum(target.store) == target.store.energy) {
				opts.resourceType = RESOURCE_ENERGY; // convert "all" requests to energy if that's all they have
			}
		}
		if (!opts.amount) {
			opts.amount = this.getOutputAmount(target, opts.resourceType!);
		}
		opts.amount *= -1;
		(opts.dAmountdt!) *= -1;
		// Register the request
		const requestID = this.requests.length;
		const req: LogisticsRequest = {
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

	/**
	 * Requests output for every mineral in a requestor object
	 */
	requestOutputMinerals(target: StoreStructure, opts = {} as RequestOptions): void {
		for (const resourceType in target.store) {
			if (resourceType == RESOURCE_ENERGY) continue;
			const amount = target.store[<ResourceConstant>resourceType] || 0;
			if (amount > 0) {
				opts.resourceType = <ResourceConstant>resourceType;
				this.requestOutput(target, opts);
			}
		}
	}

	private getInputAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		// if (target instanceof DirectivePickup) {
		// 	return target.storeCapacity - _.sum(target.store);
		// } else
		if (isResource(target) || isTombstone(target)) {
			log.error(`Improper logistics request: should not request input for resource or tombstone!`);
			return 0;
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

	private getOutputAmount(target: LogisticsTarget, resourceType: ResourceConstant | 'all'): number {
		if (resourceType == 'all') {
			if (isTombstone(target) || isStoreStructure(target)) {
				return _.sum(target.store);
			} else {
				log.error(ALL_RESOURCE_TYPE_ERROR);
				return 0;
			}
		} else {
			if (isResource(target)) {
				return target.amount;
			} else if (isTombstone(target)) {
				return target.store[resourceType] || 0;
			} else if (isStoreStructure(target)) {
				return target.store[resourceType] || 0;
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
		}
		log.warning('Could not determine output amount!');
		return 0;
	}

	// Transporter availability and predictive functions ===============================================================

	private computeNextAvailability(transporter: Zerg): [number, RoomPosition] {
		if (transporter.task) {
			let approximateDistance = transporter.task.eta;
			let pos = transporter.pos;
			const targetPositions = transporter.task.targetPosManifest;
			// If there is a well-defined task ETA, use that as the first leg, else set dist to zero and use range
			if (approximateDistance) {
				for (const targetPos of targetPositions.slice(1)) {
					// The path lengths between any two logistics targets should be well-memorized
					approximateDistance += Math.ceil(pos.getMultiRoomRangeTo(targetPos)
													 * LogisticsNetwork.settings.rangeToPathHeuristic);
					// approximateDistance += Pathing.distance(pos, targetPos);
					pos = targetPos;
				}
			} else {
				// This probably shouldn't happen...
				approximateDistance = 0;
				for (const targetPos of targetPositions) {
					approximateDistance += Math.ceil(pos.getMultiRoomRangeTo(targetPos)
													 * LogisticsNetwork.settings.rangeToPathHeuristic);
					// approximateDistance += Pathing.distance(pos, targetPos);
					pos = targetPos;
				}
			}
			return [approximateDistance, pos];
		} else {
			// Report the transporter as being near a logistics target so that Pathing.distance() won't waste CPU
			// let nearbyLogisticPositions = transporter.pos.findInRange(this.logisticPositions[transporter.room.name], 2);
			return [0, transporter.pos];
		}
	}

	/**
	 * Number of ticks until the transporter is available and where it will be
	 */
	private nextAvailability(transporter: Zerg): [number, RoomPosition] {
		if (!this.cache.nextAvailability[transporter.name]) {
			this.cache.nextAvailability[transporter.name] = this.computeNextAvailability(transporter);
		}
		return this.cache.nextAvailability[transporter.name];
	}

	static targetingTransporters(target: LogisticsTarget, excludedTransporter?: Zerg): Zerg[] {
		const targetingZerg = _.map(target.targetedBy, name => Overmind.zerg[name]);
		const targetingTransporters = _.filter(targetingZerg, zerg => zerg.roleName == Roles.transport);
		if (excludedTransporter) {
			_.remove(targetingTransporters, transporter => transporter.name == excludedTransporter.name);
		}
		return targetingTransporters;
	}

	/**
	 * Returns the predicted state of the transporter's carry after completing its current task
	 */
	private computePredictedTransporterCarry(transporter: Zerg,
											 nextAvailability?: [number, RoomPosition]): StoreDefinition {
		if (transporter.task && transporter.task.target) {
			const requestID = this.targetToRequest[transporter.task.target.ref];
			if (requestID) {
				const request = this.requests[requestID];
				if (request) {
					const carry = transporter.carry as { [resourceType: string]: number };
					const remainingCapacity = transporter.carryCapacity - _.sum(carry);
					const resourceAmount = -1 * this.predictedRequestAmount(transporter, request, nextAvailability);
					// ^ need to multiply amount by -1 since transporter is doing complement of what request needs
					if (request.resourceType == 'all') {
						if (!isStoreStructure(request.target) && !isTombstone(request.target)) {
							log.error(ALL_RESOURCE_TYPE_ERROR);
							return {energy: 0};
						}
						for (const resourceType in request.target.store) {
							const resourceFraction = (request.target.store[<ResourceConstant>resourceType] || 0)
												   / _.sum(request.target.store);
							if (carry[resourceType]) {
								carry[resourceType]! += resourceAmount * resourceFraction;
								carry[resourceType] = minMax(carry[resourceType]!, 0, remainingCapacity);
							} else {
								carry[resourceType] = minMax(resourceAmount, 0, remainingCapacity);
							}
						}
					} else {
						if (carry[request.resourceType]) {
							carry[request.resourceType]! += resourceAmount;
							carry[request.resourceType] = minMax(carry[request.resourceType]!, 0, remainingCapacity);
						} else {
							carry[request.resourceType] = minMax(resourceAmount, 0, remainingCapacity);
						}
					}
					return carry as StoreDefinition;
				}
			}
		}
		return transporter.carry;
	}

	/**
	 * Returns the predicted state of the transporter's carry after completing its task
	 */
	private predictedTransporterCarry(transporter: Zerg): StoreDefinition {
		if (!this.cache.predictedTransporterCarry[transporter.name]) {
			this.cache.predictedTransporterCarry[transporter.name] = this.computePredictedTransporterCarry(transporter);
		}
		return this.cache.predictedTransporterCarry[transporter.name];
	}

	/**
	 * Returns the effective amount that a transporter will see upon arrival, accounting for other targeting creeps
	 */
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
		const eta = busyUntil + LogisticsNetwork.settings.rangeToPathHeuristic *
					newPos.getMultiRoomRangeTo(request.target.pos);
		const predictedDifference = request.dAmountdt * eta; // dAmountdt has same sign as amount
		// Account for other transporters targeting the target
		const otherTargetingTransporters = LogisticsNetwork.targetingTransporters(request.target, transporter);
		// let closerTargetingTransporters = _.filter(otherTargetingTransporters,
		// 										   transporter => this.nextAvailability(transporter)[0] < eta);
		if (request.amount > 0) { // input state, resources into target
			let predictedAmount = request.amount + predictedDifference;
			if (isStoreStructure(request.target)) { 	// cap predicted amount at storeCapacity
				predictedAmount = Math.min(predictedAmount, request.target.storeCapacity);
			} else if (isEnergyStructure(request.target)) {
				predictedAmount = Math.min(predictedAmount, request.target.energyCapacity);
			}
			const resourceInflux = _.sum(_.map(otherTargetingTransporters,
											 other => (other.carry[<ResourceConstant>request.resourceType] || 0)));
			predictedAmount = Math.max(predictedAmount - resourceInflux, 0);
			return predictedAmount;
		} else { // output state, resources withdrawn from target
			let predictedAmount = request.amount + predictedDifference;
			if (isStoreStructure(request.target)) { 	// cap predicted amount at -1 * storeCapacity
				predictedAmount = Math.max(predictedAmount, -1 * request.target.storeCapacity);
			} else if (isEnergyStructure(request.target)) {
				predictedAmount = Math.min(predictedAmount, -1 * request.target.energyCapacity);
			}
			const resourceOutflux = _.sum(_.map(otherTargetingTransporters,
											  other => other.carryCapacity - _.sum(other.carry)));
			predictedAmount = Math.min(predictedAmount + resourceOutflux, 0);
			return predictedAmount;
		}
	}

	// Functions for computing resource change rate ====================================================================

	/**
	 * Consider all possibilities of buffer structures to visit on the way to fulfilling the request
	 */
	bufferChoices(transporter: Zerg, request: LogisticsRequest): {
		dQ: number,			// Absolute value of amount of resource transported with the choice
		dt: number,			// Amount of time to execute the choice
		targetRef: string	// Reference of the immediate target
	}[] {
		const [ticksUntilFree, newPos] = this.nextAvailability(transporter);
		const choices: { dQ: number, dt: number, targetRef: string }[] = [];
		const amount = this.predictedRequestAmount(transporter, request, [ticksUntilFree, newPos]);
		let carry: StoreDefinition;
		if (!transporter.task || transporter.task.target != request.target) {
			// If you are not targeting the requestor, use predicted carry after completing current task
			carry = this.predictedTransporterCarry(transporter);
		} else {
			// If you are targeting the requestor, use current carry for computations
			carry = transporter.carry;
		}
		if (amount > 0) { // requestInput instance, needs refilling
			if (request.resourceType == 'all') {
				log.warning(`Improper resourceType in bufferChoices! Type 'all' is only allowable for outputs!`);
				return [];
			}
			// Change in resources if transporter goes straight to the input
			const dQ_direct = Math.min(amount, carry[request.resourceType] || 0);
			// let dt_direct = Pathing.distance(newPos, request.target.pos) + ticksUntilFree;
			const dt_direct = ticksUntilFree + newPos.getMultiRoomRangeTo(request.target.pos)
							  * LogisticsNetwork.settings.rangeToPathHeuristic;
			choices.push({
							 dQ       : dQ_direct,
							 dt       : dt_direct,
							 targetRef: request.target.ref
						 });
			if ((carry[request.resourceType] || 0) > amount || _.sum(carry) == transporter.carryCapacity) {
				return choices; // Return early if you already have enough resources to go direct or are already full
			}
			// Change in resources if transporter picks up resources from a buffer first
			for (const buffer of this.buffers) {
				const dQ_buffer = Math.min(amount, transporter.carryCapacity, buffer.store[request.resourceType] || 0);
				const dt_buffer = newPos.getMultiRoomRangeTo(buffer.pos) * LogisticsNetwork.settings.rangeToPathHeuristic
								+ Pathing.distance(buffer.pos, request.target.pos) + ticksUntilFree;
				choices.push({
								 dQ       : dQ_buffer,
								 dt       : dt_buffer,
								 targetRef: buffer.ref
							 });
			}
		} else if (amount < 0) { // requestOutput instance, needs pickup
			// Change in resources if transporter goes straight to the output
			const remainingCarryCapacity = transporter.carryCapacity - _.sum(carry);
			const dQ_direct = Math.min(Math.abs(amount), remainingCarryCapacity);
			const dt_direct = newPos.getMultiRoomRangeTo(request.target.pos)
							* LogisticsNetwork.settings.rangeToPathHeuristic + ticksUntilFree;
			choices.push({
							 dQ       : dQ_direct,
							 dt       : dt_direct,
							 targetRef: request.target.ref
						 });
			if (remainingCarryCapacity >= Math.abs(amount) || remainingCarryCapacity == transporter.carryCapacity) {
				return choices; // Return early you have sufficient free space or are empty
			}
			// Change in resources if transporter drops off resources at a buffer first
			for (const buffer of this.buffers) {
				const dQ_buffer = Math.min(Math.abs(amount), transporter.carryCapacity,
										 buffer.storeCapacity - _.sum(buffer.store));
				const dt_buffer = newPos.getMultiRoomRangeTo(buffer.pos) * LogisticsNetwork.settings.rangeToPathHeuristic
								  + Pathing.distance(buffer.pos, request.target.pos) + ticksUntilFree;
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

	/**
	 * Compute the best possible value of |dResource / dt|
	 */
	private resourceChangeRate(transporter: Zerg, request: LogisticsRequest): number {
		if (!this.cache.resourceChangeRate[request.id]) {
			this.cache.resourceChangeRate[request.id] = {};
		}
		if (!this.cache.resourceChangeRate[request.id][transporter.name]) {
			const choices = this.bufferChoices(transporter, request);
			const dQ_dt = _.map(choices, choice => request.multiplier * choice.dQ / Math.max(choice.dt, 0.1));
			this.cache.resourceChangeRate[request.id][transporter.name] = _.max(dQ_dt);
		}
		return this.cache.resourceChangeRate[request.id][transporter.name];
	}

	/**
	 * Generate requestor preferences in terms of transporters
	 */
	requestPreferences(request: LogisticsRequest, transporters: Zerg[]): Zerg[] {
		// Requestors priortize transporters by change in resources per tick until pickup/delivery
		return _.sortBy(transporters, transporter => -1 * this.resourceChangeRate(transporter, request)); // -1 -> desc
	}

	/**
	 * Generate transporter preferences in terms of store structures
	 */
	transporterPreferences(transporter: Zerg): LogisticsRequest[] {
		// Transporters prioritize requestors by change in resources per tick until pickup/delivery
		return _.sortBy(this.requests, request => -1 * this.resourceChangeRate(transporter, request)); // -1 -> desc
	}

	/**
	 * Invalidates relevant portions of the cache once a transporter is assigned to a task
	 */
	invalidateCache(transporter: Zerg, request: LogisticsRequest): void {
		delete this.cache.nextAvailability[transporter.name];
		delete this.cache.predictedTransporterCarry[transporter.name];
		delete this.cache.resourceChangeRate[request.id][transporter.name];
	}

	/**
	 * Logs the output of the stable matching result
	 */
	summarizeMatching(): void {
		const requests = this.requests.slice();
		const transporters = _.filter(this.colony.getCreepsByRole(Roles.transport), creep => !creep.spawning);
		const unmatchedTransporters = _.remove(transporters,
											 transporter => !_.keys(this._matching).includes(transporter.name));
		const unmatchedRequests = _.remove(requests, request => !_.values(this._matching).includes(request));
		console.log(`Stable matching for ${this.colony.name} at ${Game.time}`);
		for (const transporter of transporters) {
			const transporterStr = transporter.name + ' ' + transporter.pos;
			const request = this._matching![transporter.name]!;
			const requestStr = request.target.ref + ' ' + request.target.pos.print;
			console.log(`${transporterStr.padRight(30)} : ${requestStr}`);
		}
		for (const transporter of unmatchedTransporters) {
			const transporterStr = transporter.name + ' ' + transporter.pos;
			console.log(`${transporterStr.padRight(30)} : ${''}`);
		}
		for (const request of unmatchedRequests) {
			const requestStr = request.target.ref + ' ' + request.target.pos;
			console.log(`${''.padRight(30)} : ${requestStr}`);
		}
		console.log();
	}

	/**
	 * Logs the current state of the logistics group to the console; useful for debugging
	 */
	summarize(): void {
		// console.log(`Summary of logistics group for ${this.colony.name} at time ${Game.time}`);
		let info = [];
		for (const request of this.requests) {
			let targetType: string;
			if (request.target instanceof Resource) {
				targetType = 'resource';
			} else if (request.target instanceof Tombstone) {
				targetType = 'tombstone';
			} else {
				targetType = request.target.structureType;
			}
			let amount = 0;
			if (isResource(request.target)) {
				amount = request.target.amount;
			} else {
				if (request.resourceType == 'all') {
					if (isTombstone(request.target) || isStoreStructure(request.target)) {
						amount = _.sum(request.target.store);
					} else if (isEnergyStructure(request.target)) {
						amount = -0.001;
					}
				} else {
					if (isTombstone(request.target) || isStoreStructure(request.target)) {
						amount = request.target.store[request.resourceType] || 0;
					} else if (isEnergyStructure(request.target)) {
						amount = request.target.energy;
					}
				}

			}
			const targetingTprtrNames = _.map(LogisticsNetwork.targetingTransporters(request.target), c => c.name);
			info.push({
						  target       : targetType,
						  resourceType : request.resourceType,
						  requestAmount: request.amount,
						  currentAmount: amount,
						  targetedBy   : targetingTprtrNames,
						  pos          : request.target.pos.print,
					  });
		}
		console.log('Requests: \n' + columnify(info) + '\n');
		info = [];
		for (const transporter of this.colony.overlords.logistics.transporters) {
			const task = transporter.task ? transporter.task.name : 'none';
			const target = transporter.task ?
						 transporter.task.proto._target.ref + ' ' + transporter.task.targetPos.printPlain : 'none';
			const nextAvailability = this.nextAvailability(transporter);
			info.push({
						  creep       : transporter.name,
						  pos         : transporter.pos.printPlain,
						  task        : task,
						  target      : target,
						  availability: `available in ${nextAvailability[0]} ticks at ${nextAvailability[1].print}`,
					  });
		}
		console.log('Transporters: \n' + columnify(info) + '\n');
	}

	get matching(): { [creepName: string]: LogisticsRequest | undefined } {
		if (!this._matching) {
			this._matching = this.stableMatching(this.colony.overlords.logistics.transporters);
		}
		return this._matching;
	}

	/**
	 * Generate a stable matching of transporters to requests with Gale-Shapley algorithm
	 */
	private stableMatching(transporters: Zerg[]): { [creepName: string]: LogisticsRequest | undefined } {
		const tPrefs: { [transporterName: string]: string[] } = {};
		for (const transporter of transporters) {
			tPrefs[transporter.name] = _.map(this.transporterPreferences(transporter), request => request.id);
		}
		const rPrefs: { [requestID: string]: string[] } = {};
		for (const request of this.requests) {
			rPrefs[request.id] = _.map(this.requestPreferences(request, transporters), transporter => transporter.name);
		}
		const stableMatching = new Matcher(tPrefs, rPrefs).match();
		const requestMatch = _.mapValues(stableMatching, reqID => _.find(this.requests, request => request.id == reqID));
		return requestMatch;
	}

}

