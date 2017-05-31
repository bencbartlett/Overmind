// A grouping for objectives that allows colony components to have their own objectives instead of all being on Overlord


export class ResourceRequestGroup implements IResourceRequestGroup {

	resourceIn: {
		haul: IResourceRequest[],
		link: IResourceRequest[]
	};
	resourceOut: {
		haul: IResourceRequest[],
		link: IResourceRequest[]
	};

	constructor() {
		this.resourceIn = {
			haul: [],
			link: [],
		};
		this.resourceOut = {
			haul: [],
			link: [],
		};
	}

	registerResourceRequest(target: StructureLink | StructureContainer, resourceType = RESOURCE_ENERGY): void {
		let request: IResourceRequest;
		if (target instanceof StructureLink) {
			request = {
				target      : target,
				amount      : target.energyCapacity - target.energy,
				resourceType: resourceType,
			};
			this.resourceIn.link.push(request);
		} else {
			request = {
				target      : target,
				amount      : target.storeCapacity - _.sum(target.store),
				resourceType: resourceType,
			};
			this.resourceIn.haul.push(request);
		}
	}

	registerWithdrawalRequest(target: StructureLink | StructureContainer, resourceType = RESOURCE_ENERGY): void {
		let request: IResourceRequest;
		if (target instanceof StructureLink) {
			request = {
				target      : target,
				amount      : target.energy,
				resourceType: resourceType,
			};
			this.resourceOut.link.push(request);
		} else {
			request = {
				target      : target,
				amount      : target.store[resourceType],
				resourceType: resourceType,
			};
			this.resourceOut.haul.push(request);
		}
	}
}

