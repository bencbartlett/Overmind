// Hauling directive: spawns hauler creeps to move large amounts of resourecs from a location (e.g. draining a storage)

import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {isStoreStructure} from '../../declarations/typeGuards';
import {HaulingOverlord} from '../../overlords/situational/hauler';


interface DirectiveHaulMemory extends FlagMemory {
	totalResources?: number;
}

@profile
export class DirectiveHaul extends Directive {

	static directiveName = 'haul';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_BLUE;

	private _store: StoreDefinition;
	private _drops: { [resourceType: string]: Resource[] };

	memory: DirectiveHaulMemory;

	constructor(flag: Flag) {
		super(flag);
		this.overlords.haul = new HaulingOverlord(this);
	}

	get targetedBy(): string[] {
		return Overmind.cache.targets[this.ref];
	}

	get drops(): { [resourceType: string]: Resource[] } {
		if (!this.pos.isVisible) {
			return {};
		}
		if (!this._drops) {
			let drops = (this.pos.lookFor(LOOK_RESOURCES) || []) as Resource[];
			this._drops = _.groupBy(drops, drop => drop.resourceType);
		}
		return this._drops;
	}

	get hasDrops(): boolean {
		return _.keys(this.drops).length > 0;
	}

	get storeStructure(): StructureStorage | StructureTerminal | StructureNuker | undefined {
		if (this.pos.isVisible) {
			return <StructureStorage>this.pos.lookForStructure(STRUCTURE_STORAGE) ||
				   <StructureTerminal>this.pos.lookForStructure(STRUCTURE_TERMINAL) ||
				   <StructureNuker>this.pos.lookForStructure(STRUCTURE_NUKER);
		}
		return undefined;
	}

	get store(): StoreDefinition {
		if (!this._store) {
			// Merge the "storage" of drops with the store of structure
			let store: { [resourceType: string]: number } = {};
			if (this.storeStructure) {
				if (isStoreStructure(this.storeStructure)) {
					store = this.storeStructure.store;
				} else {
					store = {'energy': this.storeStructure.energy};
				}
			} else {
				store = {'energy': 0};
			}
			// Merge with drops
			for (let resourceType of _.keys(this.drops)) {
				let totalResourceAmount = _.sum(this.drops[resourceType], drop => drop.amount);
				if (store[resourceType]) {
					store[resourceType] += totalResourceAmount;
				} else {
					store[resourceType] = totalResourceAmount;
				}
			}
			this._store = store as StoreDefinition;
		}
		return this._store;
	}

	/* Total amount of resources remaining to be transported; cached into memory in case room loses visibility */
	get totalResources(): number {
		if (this.pos.isVisible) {
			this.memory.totalResources = _.sum(this.store); // update total amount remaining
		} else {
			if (this.memory.totalResources == undefined) {
				return 1000; // pick some non-zero number so that haulers will spawn
			}
		}
		return this.memory.totalResources;
	}

	init(): void {

	}

	run(): void {
		if (_.sum(this.store) == 0 && this.pos.isVisible) {
			this.remove();
		}
	}


}

