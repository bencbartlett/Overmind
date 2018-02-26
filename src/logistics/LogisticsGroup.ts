// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord

import {profile} from '../lib/Profiler';
import {Zerg} from '../Zerg';
import {log} from '../lib/logger/log';
import {Pathing} from '../pathing/pathing';
import {Colony} from '../Colony';
import {TransporterSetup} from '../creepSetup/defaultSetups';


// type LogisticsTarget = EnergyStructure | StorageStructure | StructureLab | StructureNuker | StructurePowerSpawn | Zerg;
export type LogisticsTarget = StructureContainer | StructureStorage | Flag;
export type BufferTarget = StructureStorage | StructureTerminal;

export interface IRequest {
	id: string;
	target: LogisticsTarget;
	amount: number;
	resourceType: ResourceConstant;
	multiplier: number;
}

interface RequestOptions {
	amount?: number;
	resourceType?: ResourceConstant;
	multiplier?: number;
}

@profile
export class LogisticsGroup {

	requests: IRequest[];// { [priority: number]: IRequest[] };
	buffers: BufferTarget[]; // TODO: add links
	colony: Colony;
	private _matching: { [creepName: string]: IRequest | undefined } | undefined;
	// providers: IRequest[]; //{ [priority: number]: IRequest[] };
	// transporters: Zerg[];
	settings: {
		flagDropAmount: number;
		rangeToPathHeuristic: number;
	};

	constructor(colony: Colony) {
		this.requests = [];
		this.settings = {
			flagDropAmount      : 1000,
			rangeToPathHeuristic: 1.2, // findClosestByRange * this ~= findClosestByPos except in pathological cases
		};
		this.colony = colony;
		this.buffers = _.compact([colony.storage!, colony.terminal!]);
		// this.providers =  [];
	}

	get matching(): { [creepName: string]: IRequest | undefined } {
		if (!this._matching) this._matching = this.stableMatching(this.colony.getCreepsByRole(TransporterSetup.role));
		return this._matching;
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
			opts.amount = this.getRequestAmount(target, opts.resourceType!);
		}
		let requestID = this.requests.length.toString();
		let req: IRequest = {
			id          : requestID,
			target      : target,
			amount      : opts.amount,
			resourceType: opts.resourceType!,
			multiplier  : opts.multiplier!,
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
			opts.amount = this.getProvideAmount(target, opts.resourceType!);
		}
		opts.amount *= 1;
		let requestID = this.requests.length.toString();
		let req: IRequest = {
			id          : requestID,
			target      : target,
			amount      : opts.amount,
			resourceType: opts.resourceType!,
			multiplier  : opts.multiplier!,
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

	/* Consider all possibilities of what to visit on the way to fulfilling the request */
	bufferChoices(transporter: Zerg, request: IRequest): {
		deltaResource: number,
		deltaTicks: number,
		targetRef: string
	}[] {
		let [ticksUntilFree, newPos] = this.nextAvailability(transporter);
		let choices: { deltaResource: number, deltaTicks: number, targetRef: string }[] = [];
		if (request.amount > 0) { // requestor instance, needs refilling
			// Change in resources if transporter goes straight to request
			let immediateDeltaResource = Math.min(request.amount, transporter.carry[request.resourceType] || 0);
			let immediateDistance = Pathing.distance(newPos, request.target.pos) + ticksUntilFree;
			choices.push({
							 deltaResource: immediateDeltaResource,
							 deltaTicks   : immediateDistance,
							 targetRef    : request.target.ref
						 });
			// Change in resources if transporter goes to one of the buffers first
			for (let buffer of this.buffers) {
				let bufferDeltaResource = Math.min(request.amount, transporter.carryCapacity,
					buffer.store[request.resourceType] || 0);
				let bufferDistance = Pathing.distance(newPos, buffer.pos) +
									 Pathing.distance(buffer.pos, request.target.pos) + ticksUntilFree;
				choices.push({
								 deltaResource: bufferDeltaResource,
								 deltaTicks   : bufferDistance,
								 targetRef    : buffer.ref
							 });
			}
		} else if (request.amount < 0) { // provider instance, needs pickup
			// Change in resources if transporter goes straight to request
			let immediateDeltaResource = Math.min(Math.abs(request.amount), transporter.carryCapacity -
																			_.sum(transporter.carry));
			let immediateDistance = Pathing.distance(newPos, request.target.pos) + ticksUntilFree;
			choices.push({
							 deltaResource: immediateDeltaResource,
							 deltaTicks   : immediateDistance,
							 targetRef    : request.target.ref
						 });
			// Change in resources if transporter goes to one of the buffers first
			for (let buffer of this.buffers) {
				let bufferDeltaResource = Math.min(Math.abs(request.amount), transporter.carryCapacity,
					buffer.storeCapacity - _.sum(buffer.store));
				let bufferDistance = Pathing.distance(newPos, buffer.pos) +
									 Pathing.distance(buffer.pos, request.target.pos) + ticksUntilFree;
				choices.push({
								 deltaResource: bufferDeltaResource,
								 deltaTicks   : bufferDistance,
								 targetRef    : buffer.ref
							 });
			}
		}
		return choices;
	}

	private resourceChangeRate(transporter: Zerg, request: IRequest): number {
		let choices = this.bufferChoices(transporter, request);
		let resourceChangeRate = _.map(choices, choice => choice.deltaResource / choice.deltaTicks);
		return _.max(resourceChangeRate);

		// TODO: handle case where lots of small requests next to each other
		// TODO: include predictive amounts of resources
	}

	/* Generate requestor preferences in terms of transporters */
	private requestPreferences(request: IRequest, transporters: Zerg[]): Zerg[] {
		// Requestors priortize transporters by change in resources per tick until pickup/delivery
		return _.sortBy(transporters, transporter => this.resourceChangeRate(transporter, request));
	}

	/* Generate transporter preferences in terms of request structures */
	private transporterPreferences(transporter: Zerg): IRequest[] {
		// Transporters prioritize requestors by change in resources per tick until pickup/delivery
		return _.sortBy(this.requests, request => this.resourceChangeRate(transporter, request));
	}

	/* Generate a stable matching of transporters to requests with Gale-Shapley algorithm */
	private stableMatching(transporters: Zerg[]): { [creepName: string]: IRequest | undefined } {
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

/* Generate stable matching between string-indexed bipartite groups with possibly unequal numbers using Gale-Shapley */
@profile
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
		// // Pad men or women with dummies to get an equal number
		// if (this.men.length < this.women.length) {
		// 	let dummiesToAdd = this.women.length - this.men.length;
		// 	for (let i = 0; i <= dummiesToAdd; i++) {
		// 		this.men.push("dummy" + i);
		// 		for (let woman in this.womenPrefs) {
		// 			this.womenPrefs[woman].push("dummy" + i);
		// 		}
		// 	}
		// } else if (this.men.length > this.women.length) {
		// 	let dummiesToAdd = this.men.length - this.women.length;
		// 	for (let i = 0; i <= dummiesToAdd; i++) {
		// 		this.women.push("dummy" + i);
		// 		for (let man in this.menPrefs) {
		// 			this.menPrefs[man].push("dummy" + i);
		// 		}
		// 	}
		// }
		this.menFree = _.zipObject(this.men, _.map(this.men, man => true));
		this.womenFree = _.zipObject(this.women, _.map(this.women, woman => true));
		this.couples = {};
	}

	/* Return whether the woman prefer man1 over man2 */
	private prefers(woman: string, man1: string, man2: string): boolean {
		return _.indexOf(this.womenPrefs[woman], man1) < _.indexOf(this.womenPrefs[woman], man2);
	}

	/* Engage a couple <3 */
	private engage(man: string, woman: string): void {
		this.menFree[man] = false;
		this.womenFree[woman] = false;
		_.remove(this.menPrefs[man], w => w == woman); // Remove the woman that the man proposed to
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
		let MAX_ITERATIONS = 1000;
		let count = 0;
		let man = this.nextMan();
		while (man) { // While there exists a free man who still has someone to propose to
			if (count > MAX_ITERATIONS) {
				console.log('Stable matching timed out!');
				return this.couples;
			}
			let woman = _.first(this.menPrefs[man]); 		// Get first woman on man's list
			if (this.womenFree[woman]) {					// If woman is free, get engaged
				this.engage(man, woman);
			} else {										// Else if woman prefers this man to her current, swap men
				let currentMan = _.findKey(this.couples, w => w == woman);
				if (this.prefers(woman, man, currentMan)) {
					this.breakup(currentMan, woman);
					this.engage(man, woman);
				} else {
					_.remove(this.menPrefs[man], w => w == woman);	// Record an unsuccessful proposal
				}
			}
			man = this.nextMan();
			count++;
		}
		return this.couples;
	}
}
