import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {isStoreStructure} from '../../declarations/typeGuards';
import {PowerMiningOverlord} from '../../overlords/situational/powerMiner';


interface DirectivePowerMineMemory extends FlagMemory {
	totalResources?: number;
}


/**
 * PowerMining directive: kills power banks and collects the resources.
 */
@profile
export class DirectivePowerMine extends Directive {

	static directiveName = 'powerMine';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_RED;

	private _store: StoreDefinition;
	private _drops: { [resourceType: string]: Resource[] };

	memory: DirectivePowerMineMemory;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.powerMine = new PowerMiningOverlord(this);
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

	get storeStructure(): StructurePowerBank | undefined {
		if (this.pos.isVisible) {
			return <StructurePowerBank>this.pos.lookForStructure(StructurePowerBank);
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

	/**
	 * Total amount of resources remaining to be transported; cached into memory in case room loses visibility
	 */
	get totalResources(): number {
		if (this.pos.isVisible) {
			this.memory.totalResources = _.sum(this.store); // update total amount remaining
		} else {
			if (this.memory.totalResources == undefined) {
				return 1000; // pick some non-zero number so that powerMiners will spawn
			}
		}
		return this.memory.totalResources;
	}

	init(): void {
		this.alert(`PowerMine directive active`);
	}

	run(): void {
		if (_.sum(this.store) == 0 && this.pos.isVisible) {
			this.remove();
		}
	}

}

