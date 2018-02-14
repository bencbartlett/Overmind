// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord

import {profile} from '../lib/Profiler';
import {Zerg} from '../Zerg';
import {log} from '../lib/logger/log';
import {Pathing} from '../pathing/pathing';


// type LogisticsTarget = EnergyStructure | StorageStructure | StructureLab | StructureNuker | StructurePowerSpawn | Zerg;
type LogisticsTarget = StructureContainer | StructureStorage | Flag;

export interface IRequest {
	id: string;
	target: LogisticsTarget;
	amount: number;
	resourceType: ResourceConstant;
	multiplier: number;
}

interface RequestOptions {
	amount: number;
	resourceType: ResourceConstant;
	multiplier: number;
}

@profile
export class LogisticsGroup {

	requests: IRequest[];// { [priority: number]: IRequest[] };
	// providers: IRequest[]; //{ [priority: number]: IRequest[] };
	transporters: Zerg[];
	settings: {
		flagDropAmount: number;
		rangeToPathHeuristic: number;
	};

	constructor() {
		this.requests = [];
		this.settings = {
			flagDropAmount      : 1000,
			rangeToPathHeuristic: 1.2, // findClosestByRange * this ~= findClosestByPos except in pathological cases
		};
		// this.providers =  [];
	}

	// private getRequestAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
	// 	if ((<StorageStructure>target).store) {
	// 		return (<StorageStructure>target).storeCapacity - _.sum((<StorageStructure>target).store);
	// 	} else if ((<EnergyStructure>target).energy && resourceType == RESOURCE_ENERGY) {
	// 		return (<EnergyStructure>target).energyCapacity - (<EnergyStructure>target).energy;
	// 	} else if (target instanceof Zerg) {
	// 		return target.carryCapacity - _.sum(target.carry);
	// 	} else {
	// 		if (target instanceof StructureLab) {
	// 			if (resourceType == target.mineralType) {
	// 				return target.mineralCapacity - target.mineralAmount;
	// 			} else if (resourceType == RESOURCE_ENERGY) {
	// 				return target.energyCapacity - target.energy;
	// 			}
	// 		} else if (target instanceof StructureNuker) {
	// 			if (resourceType == RESOURCE_GHODIUM) {
	// 				return target.ghodiumCapacity - target.ghodium;
	// 			} else if (resourceType == RESOURCE_ENERGY) {
	// 				return target.energyCapacity - target.energy;
	// 			}
	// 		} else if (target instanceof StructurePowerSpawn) {
	// 			if (resourceType == RESOURCE_POWER) {
	// 				return target.powerCapacity - target.power;
	// 			} else if (resourceType == RESOURCE_ENERGY) {
	// 				return target.energyCapacity - target.energy;
	// 			}
	// 		}
	// 	}
	// 	log.warning('Could not determine requestor amount!');
	// 	return 0;
	// }
	//
	// private getProvideAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
	// 	if ((<StorageStructure>target).store) {
	// 		return (<StorageStructure>target).store[resourceType]!;
	// 	} else if ((<EnergyStructure>target).energy && resourceType == RESOURCE_ENERGY) {
	// 		return (<EnergyStructure>target).energy;
	// 	} else if (target instanceof Zerg) {
	// 		return target.carry[resourceType]!;
	// 	} else {
	// 		if (target instanceof StructureLab) {
	// 			if (resourceType == target.mineralType) {
	// 				return target.mineralAmount;
	// 			} else if (resourceType == RESOURCE_ENERGY) {
	// 				return target.energy;
	// 			}
	// 		} else if (target instanceof StructureNuker) {
	// 			if (resourceType == RESOURCE_GHODIUM) {
	// 				return target.ghodium;
	// 			} else if (resourceType == RESOURCE_ENERGY) {
	// 				return target.energy;
	// 			}
	// 		} else if (target instanceof StructurePowerSpawn) {
	// 			if (resourceType == RESOURCE_POWER) {
	// 				return target.power;
	// 			} else if (resourceType == RESOURCE_ENERGY) {
	// 				return target.energy;
	// 			}
	// 		}
	// 	}
	// 	log.warning('Could not determine provider amount!');
	// 	return 0;
	// }

	private getRequestAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		if (target instanceof StructureContainer || target instanceof StructureStorage) {
			return target.storeCapacity - _.sum(target.store);
		} else if (target instanceof Flag) {
			let droppedResource = _.filter(target.pos.lookFor(LOOK_RESOURCES),
										   resource => resource && resource.resourceType == resourceType)[0];
			let amount: number = droppedResource ? droppedResource.amount : 0;
			return this.settings.flagDropAmount - amount;
		}
		log.warning('Could not determine requestor amount!');
		return 0;
	}

	private getProvideAmount(target: LogisticsTarget, resourceType: ResourceConstant): number {
		if (target instanceof StructureContainer || target instanceof StructureStorage) {
			return target.store[resourceType] || 0;
		} else if (target instanceof Flag) {
			let droppedResource = _.filter(target.pos.lookFor(LOOK_RESOURCES),
										   resource => resource && resource.resourceType == resourceType)[0];
			let amount: number = droppedResource ? droppedResource.amount : 0;
			return amount;
		}
		log.warning('Could not determine provider amount!');
		return 0;
	}

	/* Request for resources to be deposited into this structure */
	request(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
		});
		if (!opts.amount) {
			opts.amount = this.getRequestAmount(target, opts.resourceType);
		}
		let requestID = this.requests.length.toString();
		let req: IRequest = {
			id          : requestID,
			target      : target,
			amount      : opts.amount,
			resourceType: opts.resourceType,
			multiplier  : opts.multiplier,
		};
		this.requests.push(req);
	}

	/* Request for resources to be withdrawn from this structure */
	provide(target: LogisticsTarget, opts = {} as RequestOptions): void {
		_.defaults(opts, {
			resourceType: RESOURCE_ENERGY,
			multiplier  : 1,
		});
		if (!opts.amount) {
			opts.amount = this.getProvideAmount(target, opts.resourceType);
		}
		opts.amount *= 1;
		let requestID = this.requests.length.toString();
		let req: IRequest = {
			id          : requestID,
			target      : target,
			amount      : opts.amount,
			resourceType: opts.resourceType,
			multiplier  : opts.multiplier,
		};
		this.requests.push(req);
	}

	/* Number of ticks until the transporter is available and where it will be */
	nextAvailability(transporter: Zerg): [number, RoomPosition] {
		if (transporter.task) {
			let approximateDistance = transporter.pos.getMultiRoomRangeTo(transporter.task.targetPos) *
									  this.settings.rangeToPathHeuristic;
			return [approximateDistance, transporter.task.targetPos];
		} else {
			let requestPositions = _.map(this.requests, req => req.target.pos);
			let nearby = transporter.pos.findInRange(requestPositions, 2)[0];
			if (nearby) {
				return [0, nearby];
			} else {
				return [0, transporter.pos];
			}
		}
	}

	private resourceChangeRate(transporter: Zerg, request: IRequest): number {
		let deltaResource = 0;
		if (request.amount > 0) {
			// requestor instance, needs refilling
			deltaResource = Math.min(request.amount, transporter.carry[request.resourceType] || 0);
		} else if (request.amount < 0) {
			// provider instance, needs pickup
			deltaResource = Math.min(Math.abs(request.amount), transporter.carryCapacity -
															   _.sum(transporter.carry));
		}
		let [ticksUntilFree, newPos] = this.nextAvailability(transporter);
		let deltaTicks = ticksUntilFree + Pathing.distance(newPos, request.target.pos);
		return deltaResource / deltaTicks;
		// TODO: handle case where thing needs refilling but you need to get resource from storage first
		// TODO: handle case where lots of small requests next to each other
		// TODO: include predictive amounts of resources
	}

	/* Generate requestor preferences in terms of transporters */
	private requestPreferences(request: IRequest): Zerg[] {
		// Requestors priortize transporters by change in resources per tick until pickup/delivery
		return _.sortBy(this.transporters, transporter => this.resourceChangeRate(transporter, request));
	}

	/* Generate transporter preferences in terms of request structures */
	private transporterPreferences(transporter: Zerg): IRequest[] {
		// Transporters prioritize requestors by change in resources per tick until pickup/delivery
		return _.sortBy(this.requests, request => this.resourceChangeRate(transporter, request));
	}

	/* Generate a stable matching of transporters to requests with Gale-Shapley algorithm */
	private stableMatching(): { [creepName: string]: IRequest | undefined } {
		let tPrefs: { [transporterName: string]: string[] } = {};
		for (let transporter of this.transporters) {
			tPrefs[transporter.name] = _.map(this.transporterPreferences(transporter), request => request.id);
		}
		let rPrefs: { [requestID: string]: string[] } = {};
		for (let request of this.requests) {
			rPrefs[request.id] = _.map(this.requestPreferences(request), transporter => transporter.name);
		}
		let stableMatching = new Matcher(tPrefs, rPrefs).match();
		let requestMatch = _.mapValues(stableMatching, reqID => _.find(this.requests, request => request.id == reqID));
		return requestMatch;
	}
}

/* Generate stable matching between string-indexed bipartite groups with possibly unequal numbers using Gale-Shapley */
class Matcher {

	men: string[];
	women: string[];
	menFree: { [man: string]: boolean };
	womenFree: { [woman: string]: boolean };
	menPrefs: { [man: string]: string[] };
	womenPrefs: { [woman: string]: string[] };
	couples: { [man: string]: string };

	constructor(menPrefs: { [man: string]: string[] }, womenPrefs: { [woman: string]: string[] }) {
		this.menPrefs = menPrefs;
		this.womenPrefs = womenPrefs;
		this.men = _.keys(menPrefs);
		this.women = _.keys(womenPrefs);
		this.menFree = _.zipObject(this.men, _.map(this.men, man => true));
		this.womenFree = _.zipObject(this.women, _.map(this.women, woman => true));
		this.couples = {};
	}

	/* Return whether the woman prefer man1 over man2 */
	private prefers(woman: string, man1: string, man2: string): boolean {
		return _.findIndex(this.womenPrefs[woman], man1) < _.findIndex(this.womenPrefs[woman], man2);
	}

	/* Engage a couple <3 */
	private engage(man: string, woman: string): void {
		this.menFree[man] = false;
		this.womenFree[woman] = false;
		_.remove(this.menPrefs[man], woman); // Remove the woman that the man proposed to
		// Don't remove from women prefs since we're matching from men side
		this.couples[man] = woman;
	}

	/* Break up a couple... </3 :'( */
	private breakup(man: string, woman: string): void {
		this.menFree[man] = true;
		this.womenFree[woman] = true;
		// Don't do anything to the preferences of men or women since they've already proposed
		delete this.couples[man];
	}

	/* Return the first free man who still has someone left to propose to */
	private nextMan(): string | undefined {
		return _.find(this.men, man => this.menFree[man] && this.menPrefs[man].length > 0);
	}

	match() {
		let man = this.nextMan();
		while (man) { // While there exists a free man who still has someone to propose to
			let woman = _.first(this.menPrefs[man]); 		// Get first woman on man's list
			if (this.womenFree[woman]) {					// If woman is free, get engaged
				this.engage(man, woman);
			} else {										// Else if woman prefers this man to her current, swap men
				let currentMan = _.findKey(this.couples, w => w == woman);
				if (this.prefers(woman, man, currentMan)) {
					this.breakup(currentMan, woman);
					this.engage(man, woman);
				} else {
					_.remove(this.menPrefs[man], woman);	// Record an unsuccessful proposal
				}
			}
			man = this.nextMan();
		}
		return this.couples;
	}
}
