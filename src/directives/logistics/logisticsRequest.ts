// import {Directive} from '../Directive';
// import {profile} from '../../profiler/decorator';
//
//
// interface DirectivePickupMemory extends FlagMemory {
// 	store?: StoreDefinition;
// 	storeCapacity?: number;
// }
//
// @profile
// export class DirectivePickup extends Directive {
//
// 	static directiveName = 'pickup';
// 	static color = COLOR_YELLOW;
// 	static secondaryColor = COLOR_YELLOW;
//
// 	ref: string; // To comply with targeting requirements
//
// 	private _store: StoreDefinition;
// 	private _drops: { [resourceType: string]: Resource[] };
//
// 	memory: DirectivePickupMemory;
//
// 	constructor(flag: Flag) {
// 		super(flag);
// 		this.ref = flag.name;
// 	}
//
// 	get targetedBy(): string[] {
// 		return Overmind.cache.targets[this.ref];
// 	}
//
// 	get drops(): { [resourceType: string]: Resource[] } {
// 		if (!this.pos.isVisible) {
// 			return {};
// 		}
// 		if (!this._drops) {
// 			let drops = (this.pos.lookFor(LOOK_RESOURCES) || []) as Resource[];
// 			this._drops = _.groupBy(drops, drop => drop.resourceType);
// 		}
// 		return this._drops;
// 	}
//
// 	get hasDrops(): boolean {
// 		return _.keys(this.drops).length > 0;
// 	}
//
// 	get storeStructure(): StructureContainer | Tombstone | undefined {
// 		if (this.pos.isVisible) {
// 			let container = <StructureContainer>this.pos.lookForStructure(STRUCTURE_CONTAINER);
// 			let tombstone = <Tombstone>this.pos.lookFor(LOOK_TOMBSTONES)[0];
// 			return container || tombstone;
// 		}
// 		return undefined;
// 	}
//
// 	/* Recalculates the state of the store; assumes you have vision of the room */
// 	private calculateStore(): StoreDefinition {
// 		// Merge the "storage" of drops with the store of structure
// 		let store: { [resourceType: string]: number } = {};
// 		if (this.storeStructure) {
// 			store = this.storeStructure.store;
// 		} else {
// 			store = {'energy': 0};
// 		}
// 		// Merge with drops
// 		for (let resourceType of _.keys(this.drops)) {
// 			let totalResourceAmount = _.sum(this.drops[resourceType], drop => drop.amount);
// 			if (store[resourceType]) {
// 				store[resourceType] += totalResourceAmount;
// 			} else {
// 				store[resourceType] = totalResourceAmount;
// 			}
// 		}
// 		return store as StoreDefinition;
// 	}
//
// 	get store(): StoreDefinition {
// 		if (!this._store) {
// 			if (this.pos.isVisible) {
// 				this._store = this.calculateStore();
// 			} else if (this.memory.store) {
// 				this._store = this.memory.store;
// 			} else {
// 				this._store = {'energy': 500}; // Assume a default amount of energy to get stable matching to care
// 			}
// 		}
// 		return this._store;
// 	}
//
// 	/* If being used as a drop-requestor, max amount of resources to drop at location */
// 	get storeCapacity(): number {
// 		if (this.memory.storeCapacity) {
// 			return this.memory.storeCapacity;
// 		} else {
// 			return 999;
// 		}
// 	}
//
// 	init(): void {
// 		if (this.pos.isVisible) {
// 			// Refresh the state of the store in flag memory
// 			this.memory.store = this.store;
// 		}
// 		this.colony.logisticsNetwork.requestOutputAll(this);
// 	}
//
// 	run(): void {
// 		// Remove flag if you are a provider and out of resources
// 		if (_.sum(this.store) == 0) {
// 			this.remove();
// 		}
// 	}
//
// }
//
