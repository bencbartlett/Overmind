// Logistics Group: efficiently partners resource requests with transporters using a stable matching algorithm to
// provide general-purpose resource transport

import {profile} from '../profiler/decorator';
import {Zerg} from '../Zerg';
import {log} from '../lib/logger/log';
import {Pathing} from '../pathing/pathing';
import {Colony} from '../Colony';
import {TransporterSetup} from '../creepSetup/defaultSetups';
import {Matcher} from '../algorithms/galeShapley';
import {EnergyStructure, isEnergyStructure, isStoreStructure, StoreStructure} from '../declarations/typeGuards';
import {DirectiveLogisticsRequest} from '../directives/logistics/directive_logisticsRequest';


export type LogisticsTarget =
	EnergyStructure
	| StoreStructure
	| StructureLab
	| StructureNuker
	| StructurePowerSpawn
	| DirectiveLogisticsRequest// | Zerg;
export type BufferTarget = StructureStorage | StructureTerminal;

export interface Request {
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

@profile
export class LogisticsGroup {

	requests: Request[];// { [priority: number]: Request[] };
	buffers: BufferTarget[]; // TODO: add links
	colony: Colony;
	private targetToRequest: { [targetRef: string]: number };
	private _matching: { [creepName: string]: Request | undefined } | undefined;
	// providers: Request[]; //{ [priority: number]: Request[] };
	// transporters: Zerg[];
	settings: {
		flagDropAmount: number;
		rangeToPathHeuristic: number;
	};

	constructor(colony: Colony) {
		this.requests = [];
		this.targetToRequest = {};
		this.settings = {
			flagDropAmount      : 1000,
			rangeToPathHeuristic: 1.1, // findClosestByRange * this ~= findClosestByPos except in pathological cases
		};
		this.colony = colony;
		this.buffers = _.compact([colony.storage!, colony.terminal!]);
	}

	private getRequestAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		if (target instanceof DirectiveLogisticsRequest) {
			return target.storeCapacity - _.sum(target.store);
		} else if (isStoreStructure(target)) {
			return target.storeCapacity - _.sum(target.store);
		} else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
			return target.energyCapacity - target.energy;
		} else if (target instanceof Zerg) {
			return target.carryCapacity - _.sum(target.carry);
		} else {
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
		log.warning('Could not determine requestor amount!');
		return 0;
	}

	private getProvideAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		if (target instanceof DirectiveLogisticsRequest) {
			return target.store[resourceType]!;
		} else if (isStoreStructure(target)) {
			return target.store[resourceType]!;
		} else if (isEnergyStructure(target) && resourceType == RESOURCE_ENERGY) {
			return target.energy;
		} else if (target instanceof Zerg) {
			return target.carry[resourceType]!;
		} else {
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
		log.warning('Could not determine provider amount!');
		return 0;
	}

	/* Request for resources to be deposited into this target */
	request(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
			dAmountdt   : 0,
		});
		if (target.room != this.colony.room) {
			console.log(`${target} is outside colony room; shouldn't request!`);
		}
		if (!opts.amount) {
			opts.amount = this.getRequestAmount(target, opts.resourceType!);
		}
		// Register the request
		let requestID = this.requests.length;
		let req: Request = {
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
	provide(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
			dAmountdt   : 0,
		});
		if (!opts.amount) {
			opts.amount = this.getProvideAmount(target, opts.resourceType!);
		}
		opts.amount *= -1;
		(opts.dAmountdt!) *= -1;
		// Register the request
		let requestID = this.requests.length;
		let req: Request = {
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


	/* Number of ticks until the transporter is available and where it will be */
	private nextAvailability(transporter: Zerg): [number, RoomPosition] {
		if (transporter.task) {
			let approximateDistance = transporter.task.eta;
			let pos = transporter.pos;
			let targetPositions = transporter.task.targetPosManifest;
			// If there is a well-defined task ETA, use that as the first leg, else set dist to zero and use range
			if (approximateDistance) {
				for (let targetPos of targetPositions.slice(1)) {
					approximateDistance += pos.getMultiRoomRangeTo(targetPos) * this.settings.rangeToPathHeuristic;
					pos = targetPos;
				}
			} else {
				approximateDistance = 0;
				for (let targetPos of targetPositions) {
					approximateDistance += pos.getMultiRoomRangeTo(targetPos) * this.settings.rangeToPathHeuristic;
					pos = targetPos;
				}
			}
			return [approximateDistance, _.last(targetPositions)];
		} else {
			return [0, transporter.pos];
			// let requestPositions = _.map(this.requests, req => req.target.pos);
			// let nearby = transporter.pos.findInRange(requestPositions, 2)[0];
			// if (nearby) {
			// 	return [0, nearby];
			// } else {
			// 	return [0, transporter.pos];
			// }
		}
	}

	// /* Number of ticks until the transporter is available and where it will be */
	// private nextAvailability(transporter: Zerg): [number, RoomPosition] {
	// 	if (transporter.task) {
	// 		let approximateDistance = 0;
	// 		let pos = transporter.pos;
	// 		let manifest = transporter.task.manifest;
	// 		for (let task of manifest) {
	// 			approximateDistance += pos.getMultiRoomRangeTo(task.targetPos) * this.settings.rangeToPathHeuristic;
	// 			pos = task.targetPos;
	// 		}
	// 		// transporter.pos.getMultiRoomRangeTo(transporter.task.targetPos) *
	// 		// 						  this.settings.rangeToPathHeuristic;
	// 		return [approximateDistance, _.last(manifest).targetPos];
	// 	} else {
	// 		return [0, transporter.pos];
	// 		// let requestPositions = _.map(this.requests, req => req.target.pos);
	// 		// let nearby = transporter.pos.findInRange(requestPositions, 2)[0];
	// 		// if (nearby) {
	// 		// 	return [0, nearby];
	// 		// } else {
	// 		// 	return [0, transporter.pos];
	// 		// }
	// 	}
	// }

	static targetingTransporters(target: LogisticsTarget, excludedTransporter?: Zerg): Zerg[] {
		let targetingZerg = _.map(target.targetedBy, name => Game.zerg[name]);
		let targetingTransporters = _.filter(targetingZerg, zerg => zerg.roleName == TransporterSetup.role);
		if (excludedTransporter) _.remove(targetingTransporters, transporter => transporter == excludedTransporter);
		return targetingTransporters;
	}

	/* Returns the effective amount of the request given other targeting creeps */
	predictedAmount(transporter: Zerg, request: Request, availability = 0, newPos = transporter.pos): number {
		let otherTargetingTransporters = LogisticsGroup.targetingTransporters(request.target, transporter);
		let ETA: number | undefined;
		if (transporter.task && transporter.task.target == request.target) {
			ETA = transporter.task.eta;
		}
		if (!ETA) ETA = this.settings.rangeToPathHeuristic * request.target.pos.getMultiRoomRangeTo(newPos)
						+ availability;
		let predictedDifference = request.dAmountdt * ETA;
		if (request.amount > 0) { // request state, energy in
			let resourceInflux = _.sum(_.map(otherTargetingTransporters,
											 transporter => transporter.carry[request.resourceType] || 0));
			return Math.max(request.amount + predictedDifference - resourceInflux, 0);
		} else { // provide state, energy out
			let resourceOutflux = _.sum(_.map(otherTargetingTransporters,
											  transporter => transporter.carryCapacity - _.sum(transporter.carry)));
			return Math.min(request.amount + predictedDifference + resourceOutflux, 0);
		}
	}

	/* Returns the predicted state of the transporter's carry at the end of its task */
	private predictedCarry(transporter: Zerg): StoreDefinition {
		if (transporter.task && transporter.task.target) {
			let requestID = this.targetToRequest[transporter.task.target.ref];
			if (requestID) {
				let request = this.requests[requestID];
				if (request) {
					let carry = transporter.carry;
					if (carry[request.resourceType]) {
						// Need to multiply amount by -1 since transporter is doing complement of request
						carry[request.resourceType]! += -1 * this.predictedAmount(transporter, request);
					} else {
						carry[request.resourceType] = this.predictedAmount(transporter, request);
					}
					return carry;
				}
			}
		}
		return transporter.carry;
	}

	/* Consider all possibilities of buffer structures to visit on the way to fulfilling the request */
	bufferChoices(transporter: Zerg, request: Request): {
		deltaResource: number,
		deltaTicks: number,
		targetRef: string
	}[] {
		let [ticksUntilFree, newPos] = this.nextAvailability(transporter);
		let choices: { deltaResource: number, deltaTicks: number, targetRef: string }[] = [];
		let amount = this.predictedAmount(transporter, request, ticksUntilFree, newPos);
		let carry = this.predictedCarry(transporter);
		if (amount > 0) { // requestor instance, needs refilling
			// Change in resources if transporter goes straight to request
			let immediateDeltaResource = Math.min(amount, carry[request.resourceType] || 0);
			let immediateDistance = Pathing.distance(newPos, request.target.pos) + ticksUntilFree;
			choices.push({
							 deltaResource: immediateDeltaResource,
							 deltaTicks   : immediateDistance,
							 targetRef    : request.target.ref
						 });
			// Change in resources if transporter goes to one of the buffers first
			for (let buffer of this.buffers) {
				let bufferDeltaResource = Math.min(amount, transporter.carryCapacity,
					buffer.store[request.resourceType] || 0);
				let bufferDistance = Pathing.distance(newPos, buffer.pos) +
									 Pathing.distance(buffer.pos, request.target.pos) + ticksUntilFree;
				choices.push({
								 deltaResource: bufferDeltaResource,
								 deltaTicks   : bufferDistance,
								 targetRef    : buffer.ref
							 });
			}
		} else if (amount < 0) { // provider instance, needs pickup
			// Change in resources if transporter goes straight to request
			let immediateDeltaResource = Math.min(Math.abs(amount), transporter.carryCapacity - _.sum(carry));
			let immediateDistance = Pathing.distance(newPos, request.target.pos) + ticksUntilFree;
			choices.push({
							 deltaResource: immediateDeltaResource,
							 deltaTicks   : immediateDistance,
							 targetRef    : request.target.ref
						 });
			// Change in resources if transporter goes to one of the buffers first
			for (let buffer of this.buffers) {
				let bufferDeltaResource = Math.min(Math.abs(amount), transporter.carryCapacity,
					buffer.storeCapacity - _.sum(buffer.store));
				let bufferDistance = Pathing.distance(newPos, buffer.pos) +
									 Pathing.distance(buffer.pos, request.target.pos) + ticksUntilFree;
				choices.push({
								 deltaResource: bufferDeltaResource,
								 deltaTicks   : bufferDistance,
								 targetRef    : buffer.ref
							 });
			}
			// if (request.resourceType == RESOURCE_ENERGY) {
			// 	// Only for when you're picking up more energy: check to see if you can put to available links
			// 	for (let link of this.colony.dropoffLinks) {
			// 		let linkDeltaResource = Math.min(Math.abs(amount), transporter.carryCapacity,
			// 			2 * link.energyCapacity);
			// 		let ticksUntilDropoff = Math.max(Pathing.distance(newPos, link.pos),
			// 										 this.colony.linkNetwork.getDropoffAvailability(link));
			// 		let linkDistance = ticksUntilDropoff +
			// 						   Pathing.distance(link.pos, request.target.pos) + ticksUntilFree;
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
	private resourceChangeRate(transporter: Zerg, request: Request): number {
		let choices = this.bufferChoices(transporter, request);
		let resourceChangeRate = _.map(choices, choice => choice.deltaResource / choice.deltaTicks);
		return _.max(resourceChangeRate);
		// TODO: handle case where lots of small requests next to each other
	}

	/* Generate requestor preferences in terms of transporters */
	private requestPreferences(request: Request, transporters: Zerg[]): Zerg[] {
		// Requestors priortize transporters by change in resources per tick until pickup/delivery
		return _.sortBy(transporters, transporter => -1 * this.resourceChangeRate(transporter, request)); // -1 -> desc
	}

	/* Generate transporter preferences in terms of request structures */
	private transporterPreferences(transporter: Zerg): Request[] {
		// Transporters prioritize requestors by change in resources per tick until pickup/delivery
		return _.sortBy(this.requests, request => -1 * this.resourceChangeRate(transporter, request)); // -1 -> desc
	}

	get matching(): { [creepName: string]: Request | undefined } {
		if (!this._matching) {
			let transporters = _.filter(this.colony.getCreepsByRole(TransporterSetup.role), creep => !creep.spawning);
			this._matching = this.stableMatching(transporters);
			// this.summarizeMatching();
		}
		return this._matching;
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

	/* Logs the current state of the logistics group; useful for debugging */
	summarize(): void {
		// console.log(`Summary of logistics group for ${this.colony.name} at time ${Game.time}`);
		console.log('Requests:');
		for (let request of this.requests) {
			let targetType = request.target instanceof DirectiveLogisticsRequest ? 'flag' :
							 request.target.structureType;
			let energy = request.target instanceof StructureContainer ? request.target.energy : 0;
			let targetingTransporters = LogisticsGroup.targetingTransporters(request.target);
			console.log(`    Target: ${targetType} ${request.target.pos.print} ${request.target.ref}    ` +
						`Amount: ${request.amount}    Energy: ${energy}    Targeted by: ${targetingTransporters}`);
		}
		console.log('Transporters:');
		for (let transporter of this.colony.getCreepsByRole(TransporterSetup.role)) {
			let task = transporter.task ? transporter.task.name : 'none';
			let target = transporter.task ?
						 transporter.task.proto._target.ref + ' ' + transporter.task.targetPos.print : 'none';
			let nextAvailability = this.nextAvailability(transporter);
			console.log(`    Creep: ${transporter.name}    Pos: ${transporter.pos.print}    Task: ${task}    Target: ${target}    ` +
						`Available in ${Math.floor(nextAvailability[0])} ticks at ${nextAvailability[1].print}`);
		}
		console.log();
	}

	/* Generate a stable matching of transporters to requests with Gale-Shapley algorithm */
	private stableMatching(transporters: Zerg[]): { [creepName: string]: Request | undefined } {
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

