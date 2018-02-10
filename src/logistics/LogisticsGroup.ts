// // A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord
//
// import {profile} from '../lib/Profiler';
// import {blankPriorityQueue, Priority} from '../config/priorities';
// import {Zerg} from '../Zerg';
// import {log} from '../lib/logger/log';
// import {Pathing} from '../pathing/pathing';
//
//
// // type LogisticsTarget = EnergyStructure | StorageStructure | StructureLab | StructureNuker | StructurePowerSpawn | Zerg;
// type LogisticsTarget = StructureContainer | StructureStorage | Flag;
//
// export interface IRequest {
// 	target: LogisticsTarget;
// 	amount: number;
// 	resourceType: ResourceConstant;
// 	multiplier: number;
// }
//
// interface RequestOptions {
// 	amount: number;
// 	resourceType: ResourceConstant;
// 	multiplier: number;
// }
//
// @profile
// export class LogisticsGroup {
//
// 	requests:IRequest[];// { [priority: number]: IRequest[] };
// 	// providers: IRequest[]; //{ [priority: number]: IRequest[] };
//
// 	constructor() {
// 		this.requests = [];
// 		// this.providers =  [];
// 	}
//
// 	private getRequestAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
// 		if ((<StorageStructure>target).store) {
// 			return (<StorageStructure>target).storeCapacity - _.sum((<StorageStructure>target).store);
// 		} else if ((<EnergyStructure>target).energy && resourceType == RESOURCE_ENERGY) {
// 			return (<EnergyStructure>target).energyCapacity - (<EnergyStructure>target).energy;
// 		} else if (target instanceof Zerg) {
// 			return target.carryCapacity - _.sum(target.carry);
// 		} else {
// 			if (target instanceof StructureLab) {
// 				if (resourceType == target.mineralType) {
// 					return target.mineralCapacity - target.mineralAmount;
// 				} else if (resourceType == RESOURCE_ENERGY) {
// 					return target.energyCapacity - target.energy;
// 				}
// 			} else if (target instanceof StructureNuker) {
// 				if (resourceType == RESOURCE_GHODIUM) {
// 					return target.ghodiumCapacity - target.ghodium;
// 				} else if (resourceType == RESOURCE_ENERGY) {
// 					return target.energyCapacity - target.energy;
// 				}
// 			} else if (target instanceof StructurePowerSpawn) {
// 				if (resourceType == RESOURCE_POWER) {
// 					return target.powerCapacity - target.power;
// 				} else if (resourceType == RESOURCE_ENERGY) {
// 					return target.energyCapacity - target.energy;
// 				}
// 			}
// 		}
// 		log.warning('Could not determine requestor amount!');
// 		return 0;
// 	}
//
// 	private getProvideAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
// 		if ((<StorageStructure>target).store) {
// 			return (<StorageStructure>target).store[resourceType]!;
// 		} else if ((<EnergyStructure>target).energy && resourceType == RESOURCE_ENERGY) {
// 			return (<EnergyStructure>target).energy;
// 		} else if (target instanceof Zerg) {
// 			return target.carry[resourceType]!;
// 		} else {
// 			if (target instanceof StructureLab) {
// 				if (resourceType == target.mineralType) {
// 					return target.mineralAmount;
// 				} else if (resourceType == RESOURCE_ENERGY) {
// 					return target.energy;
// 				}
// 			} else if (target instanceof StructureNuker) {
// 				if (resourceType == RESOURCE_GHODIUM) {
// 					return target.ghodium;
// 				} else if (resourceType == RESOURCE_ENERGY) {
// 					return target.energy;
// 				}
// 			} else if (target instanceof StructurePowerSpawn) {
// 				if (resourceType == RESOURCE_POWER) {
// 					return target.power;
// 				} else if (resourceType == RESOURCE_ENERGY) {
// 					return target.energy;
// 				}
// 			}
// 		}
// 		log.warning('Could not determine provider amount!');
// 		return 0;
// 	}
//
// 	/* Request for resources to be deposited into this structure */
// 	request(target: LogisticsTarget, opts = {} as RequestOptions): void {
// 		_.defaults(opts, {
// 			resourceType: RESOURCE_ENERGY,
// 			multiplier  : 1,
// 		});
// 		if (!opts.amount) {
// 			opts.amount = this.getRequestAmount(target, opts.resourceType);
// 		}
// 		let req: IRequest = {
// 			target      : target,
// 			amount      : opts.amount,
// 			resourceType: opts.resourceType,
// 			multiplier  : opts.multiplier,
// 		};
// 		this.requests.push(req);
// 	}
//
// 	/* Request for resources to be withdrawn from this structure */
// 	provide(target: LogisticsTarget, opts = {} as RequestOptions): void {
// 		_.defaults(opts, {
// 			resourceType: RESOURCE_ENERGY,
// 			multiplier  : 1,
// 		});
// 		if (!opts.amount) {
// 			opts.amount = this.getProvideAmount(target, opts.resourceType);
// 		}
// 		opts.amount *= 1;
// 		let req: IRequest = {
// 			target      : target,
// 			amount      : opts.amount,
// 			resourceType: opts.resourceType,
// 			multiplier  : opts.multiplier,
// 		};
// 		this.requests.push(req);
// 	}
//
// 	/* Generate requestor preferences in terms of transporters */
// 	private requestPreferences(request: IRequest): Zerg[] {
// 		// Requestors priortize transporters by change in resources per tick until pickup/delivery
// 		let transporters: Zerg[] = [];
// 		return _.sortBy(transporters, function (transporter) {
// 			let resourceChange = 0;
// 			if (request.amount > 0) {
// 				// requestor instance, needs refilling
// 				resourceChange = Math.min(request.amount, transporter.carry[request.resourceType] || 0);
// 			} else {
// 				resourceChange = Math.min(Math.abs(request.amount), transporter.carry[request.resourceType] || 0);
// 			}
// 			let ticksToReach = transporter.pos.getMultiRoomRangeTo(request.target.pos);
// 			return resourceChange / ticksToReach;
// 			// TODO: handle case where thing needs refilling but you need to get resource from storage first
// 			// TODO: handle case where lots of small requests next to each other
// 		});
// 	}
//
// 	/* Generate transporter preferences in terms of request structures */
// 	private transporterPreferences(transporter: Zerg): IRequest[] {
// 		// Transporters prioritize requestors by change in resources per tick until pickup/delivery
// 		return _.sortBy(this.requests, function (request) {
// 			let resourceChange = 0;
// 			if (request.amount > 0) {
// 				// requestor instance, needs refilling
// 				resourceChange = Math.min(request.amount, transporter.carry[request.resourceType] || 0);
// 			} else {
// 				resourceChange = Math.min(Math.abs(request.amount), transporter.carry[request.resourceType] || 0);
// 			}
// 			let ticksToReach = transporter.pos.getMultiRoomRangeTo(request.target.pos);
// 			return resourceChange / ticksToReach;
// 			// TODO: handle case where thing needs refilling but you need to get resource from storage first
// 			// TODO: handle case where lots of small requests next to each other
// 		});
// 	}
//
// 	private stableMatching(): {[creepName: string]: LogisticsTarget} {
//
// 	}
//
// }
