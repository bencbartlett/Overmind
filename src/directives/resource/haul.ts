import {$} from '../../caching/GlobalCache';
import {HaulingOverlord} from '../../overlords/situational/hauler';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';


interface DirectiveHaulMemory extends FlagMemory {
	totalResources?: number;
	hasDrops?: boolean;
	// store: { [resource: string]: number };
	path?: {
		plain: number,
		swamp: number,
		road: number
	};
}


/**
 * Hauling directive: spawns hauler creeps to move large amounts of resources from a location (e.g. draining a storage)
 */
@profile
export class DirectiveHaul extends Directive {

	static directiveName = 'haul';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_BLUE;

	private _store: StoreContents | undefined;
	private _drops: DropContents;
	private _finishAtTime: number;

	memory: DirectiveHaulMemory;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.haul = new HaulingOverlord(this);
	}

	get targetedBy(): string[] {
		return Overmind.cache.targets[this.ref];
	}

	get drops(): DropContents {
		if (!this.pos.isVisible) {
			return <DropContents>{};
		}
		if (!this._drops) {
			const drops = (this.pos.lookFor(LOOK_RESOURCES) || []) as Resource[];
			this._drops = <DropContents>_.groupBy(drops, drop => drop.resourceType);
		}
		return this._drops;
	}

	get hasDrops(): boolean {
		return _.keys(this.drops).length > 0;
	}

	get storeStructure(): StructureStorage | StructureTerminal | StructureNuker | StructureContainer | Ruin | undefined {
		// TODO remove me console.log(`Looking for store struct in ${this.pos.roomName}
		// with ${this.pos.lookForStructure(STRUCTURE_CONTAINER)}`);
		if (this.pos.isVisible) {
			return <StructureStorage>this.pos.lookForStructure(STRUCTURE_STORAGE) ||
				   <StructureTerminal>this.pos.lookForStructure(STRUCTURE_TERMINAL) ||
				   <StructureNuker>this.pos.lookForStructure(STRUCTURE_NUKER) ||
				   <StructureContainer>this.pos.lookForStructure(STRUCTURE_CONTAINER) ||
				   <Ruin>this.pos.lookFor(LOOK_RUINS).filter(ruin => ruin.store.getUsedCapacity() > 0)[0];
		}
		return undefined;
	}

	get store(): StoreContents {
		if (!this._store) {
			// Merge the "storage" of drops with the store of structure
			let store = <StoreContents>{};
			if (this.storeStructure) {
				store = this.storeStructure.store;
			} else {
				store = <StoreContents>{energy: 0};
			}
			// Merge with drops
			for (const resourceType of (_.keys(this.drops) as ResourceConstant[])) {
				const totalResourceAmount = _.sum(this.drops[resourceType] as Resource[], drop => drop.amount);
				if (store[resourceType]) {
					store[resourceType] += totalResourceAmount;
				} else {
					store[resourceType] = totalResourceAmount;
				}
			}
			this._store = store;
		}
		// log.alert(`Haul directive ${this.print} has store of ${JSON.stringify(this._store)}`);
		return this._store;
	}

	/**
	 * Total amount of resources remaining to be transported; cached into memory in case room loses visibility
	 */
	get totalResources(): number {
		if (this.pos.isVisible && this.store) {
			this.memory.totalResources = _.sum(this.store); // update total amount remaining
		} else {
			if (this.memory.totalResources == undefined) {
				return 1000; // pick some non-zero number so that haulers will spawn
			}
		}
		return this.memory.totalResources;
	}

	refresh(): void {
		super.refresh();
		this._store = undefined;
	}

	init(): void {
		this.alert(`Haul directive active - ${this.totalResources}`);
	}

	run(): void {
		if (this.pos.isVisible && _.sum(this.store) == 0) {
			// If everything is picked up, crudely give enough time to bring it back
			this._finishAtTime = this._finishAtTime || (Game.time + 300);
		}
		if (Game.time >= this._finishAtTime || (this.totalResources == 0 &&
												(this.overlords.haul as HaulingOverlord).haulers.length == 0)) {
			// this.remove();
		}
	}
}

