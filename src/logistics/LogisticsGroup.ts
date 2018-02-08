// // A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord
//
// import {profile} from '../lib/Profiler';
// import {blankPriorityQueue, Priority} from '../config/priorities';
// import {Zerg} from '../Zerg';
//
// export type EnergyRequestStructure = Sink | StructureContainer;
// export type ResourceRequestStructure = StructureLab | StructureNuker | StructurePowerSpawn | StructureContainer;
//
// export type EnergyWithdrawStructure = StructureContainer | StructureTerminal | StructureLink;
// export type ResourceWithdrawStructure = StructureLab | StructureContainer | StructureTerminal;
//
// export interface IResourceRequest {
// 	target: EnergyRequestStructure | ResourceRequestStructure;
// 	amount: number;
// 	resourceType: string;
// }
//
// export interface IWithdrawRequest {
// 	target: EnergyWithdrawStructure | ResourceWithdrawStructure;
// 	amount: number;
// 	resourceType: string;
// }
//
//
// @profile
// export class LogisticsGroup {
//
// 	supply: { [priority: number]: IResourceRequest[] };
// 	withdraw: { [priority: number]: IWithdrawRequest[] };
//
// 	constructor() {
// 		this.supply = blankPriorityQueue();
// 		this.withdraw = blankPriorityQueue();
// 	}
//
// 	requestEnergy(target: EnergyRequestStructure, priority = Priority.Normal, amount?: number): void {
// 		let request: IResourceRequest;
// 		if (!amount) {
// 			if (target instanceof StructureContainer) {
// 				amount = target.storeCapacity - _.sum(target.store);
// 			} else {
// 				amount = target.energyCapacity - target.energy;
// 			}
// 		}
// 		request = {
// 			target      : target,
// 			amount      : amount,
// 			resourceType: RESOURCE_ENERGY,
// 		};
// 		this.supply[priority].push(request);
// 	}
//
// 	requestResource(target: ResourceRequestStructure, resourceType: ResourceConstant,
// 					priority = Priority.Normal, amount?: number): void {
// 		let request: IResourceRequest;
// 		if (!amount) {
// 			if (target instanceof StructureLab) {
// 				amount = target.mineralCapacity - target.mineralAmount;
// 			} else if (target instanceof StructureNuker) {
// 				amount = target.ghodiumCapacity - target.ghodium;
// 			} else if (target instanceof StructurePowerSpawn) {
// 				amount = target.powerCapacity - target.power;
// 			} else {
// 				amount = target.storeCapacity - _.sum(target.store);
// 			}
// 		}
// 		request = {
// 			target      : target,
// 			amount      : amount,
// 			resourceType: resourceType,
// 		};
// 		this.supply[priority].push(request);
// 	}
//
// 	requestWithdrawal(target: EnergyWithdrawStructure, priority = Priority.Normal, amount?: number): void {
// 		let request: IWithdrawRequest;
// 		if (!amount) {
// 			if (target instanceof StructureContainer) {
// 				amount = target.store[RESOURCE_ENERGY];
// 			} else {
// 				amount = target.energy;
// 			}
// 		}
// 		request = {
// 			target      : target,
// 			amount      : amount!,
// 			resourceType: RESOURCE_ENERGY,
// 		};
// 		this.withdraw[priority].push(request);
// 	}
//
// 	requestResourceWithdrawal(target: ResourceWithdrawStructure, resourceType: ResourceConstant,
// 							  priority = Priority.Normal, amount?: number): void {
// 		let request: IWithdrawRequest;
// 		if (!amount) {
// 			if (target instanceof StructureLab) {
// 				amount = target.mineralAmount;
// 			} else if (target instanceof StructureNuker) {
// 				amount = target.ghodium;
// 			} else if (target instanceof StructurePowerSpawn) {
// 				amount = target.power;
// 			} else {
// 				amount = target.store[resourceType]!;
// 			}
// 		}
// 		request = {
// 			target      : target,
// 			amount      : amount,
// 			resourceType: resourceType,
// 		};
// 		this.withdraw[priority].push(request);
// 	}
//
// 	// /* Generate requestor preferences in terms of transporters */
// 	// private requestPreferences(): {[structureRef: string]: Zerg[]} {
// 	// 	// Requestors priortize transporters by change in resources per tick until pickup/delivery
// 	// }
// 	//
// 	// /* Generate transporter preferences in terms of request structures */
// 	// private transporterPreferences(): {[creepName: string]: Structure[]} {
// 	// 	// Transporters prioritize requestors by change in resources per tick until pickup/delivery
// 	// }
// 	//
// 	// private stableMatching(): {[creepName: string]: Structure} {
// 	//
// 	// }
//
// }
