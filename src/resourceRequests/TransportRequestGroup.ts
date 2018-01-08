// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord

import {profile} from '../lib/Profiler';

type EnergyRequestStructure = Sink | StructureContainer;
type ResourceRequestStructure = StructureLab | StructureNuker | StructurePowerSpawn | StructureContainer;

type EnergyWithdrawStructure = StructureContainer | StructureTerminal | StructureLink;
type ResourceWithdrawStructure = StructureLab | StructureContainer | StructureTerminal;


@profile
export class TransportRequestGroup implements ITransportRequestGroup {

	supply: IResourceRequest[];
	withdraw: IWithdrawRequest[];

	constructor() {
		this.supply = [];
		this.withdraw = [];
	}

	requestEnergy(target: EnergyRequestStructure, amount?: number): void {
		let request: IResourceRequest;
		if (!amount) {
			if (target instanceof StructureContainer) {
				amount = target.storeCapacity - _.sum(target.store);
			} else {
				amount = target.energyCapacity - target.energy;
			}
		}
		request = {
			target      : target,
			amount      : amount,
			resourceType: RESOURCE_ENERGY,
		};
		this.supply.push(request);
	}

	requestResource(target: ResourceRequestStructure, resourceType: ResourceConstant, amount?: number): void {
		let request: IResourceRequest;
		if (!amount) {
			if (target instanceof StructureLab) {
				amount = target.mineralCapacity - target.mineralAmount;
			} else if (target instanceof StructureNuker) {
				amount = target.ghodiumCapacity - target.ghodium;
			} else if (target instanceof StructurePowerSpawn) {
				amount = target.powerCapacity - target.power;
			} else {
				amount = target.storeCapacity - _.sum(target.store);
			}
		}
		request = {
			target      : target,
			amount      : amount,
			resourceType: resourceType,
		};
		this.supply.push(request);
	}

	requestWithdrawal(target: EnergyWithdrawStructure, amount?: number): void {
		let request: IWithdrawRequest;
		if (!amount) {
			if (target instanceof StructureContainer) {
				amount = target.store[RESOURCE_ENERGY];
			} else {
				amount = target.energy;
			}
		}
		request = {
			target      : target,
			amount      : amount!,
			resourceType: RESOURCE_ENERGY,
		};
		this.withdraw.push(request);
	}

	requestResourceWithdrawal(target: ResourceWithdrawStructure, resourceType: ResourceConstant, amount?: number): void {
		let request: IWithdrawRequest;
		if (!amount) {
			if (target instanceof StructureLab) {
				amount = target.mineralAmount;
			} else if (target instanceof StructureNuker) {
				amount = target.ghodium;
			} else if (target instanceof StructurePowerSpawn) {
				amount = target.power;
			} else {
				amount = target.store[resourceType]!;
			}
		}
		request = {
			target      : target,
			amount      : amount,
			resourceType: resourceType,
		};
		this.withdraw.push(request);
	}

}
