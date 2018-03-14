import {Directive} from '../Directive';
import {profile} from '../../lib/Profiler';


interface DirectiveLogisticsReqeustMemory extends FlagMemory {
	request?: { [resourceType: string]: number };
	storeCapacity?: number;
	provider: boolean;
}

@profile
export class DirectiveLogisticsRequest extends Directive {

	static directiveName = 'logisticsRequest';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_YELLOW;

	ref: string;	// To comply with targeting requirements

	private _store: StoreDefinition;
	private _drops: { [resourceType: string]: Resource[] };

	memory: DirectiveLogisticsReqeustMemory;

	constructor(flag: Flag) {
		super(flag);
		this.ref = flag.name;
	}

	get targetedBy(): string[] {
		return Overmind.cache.targets[this.ref];
	}

	get drops(): { [resourceType: string]: Resource[] } {
		if (!this._drops) {
			let drops = (this.pos.lookFor(LOOK_RESOURCES) || []) as Resource[];
			this._drops = _.groupBy(drops, drop => drop.resourceType);
		}
		return this._drops;
	}

	get provider(): boolean {
		if (!this.memory.provider) {
			this.memory.provider = (_.keys(this.drops).length > 0);
		}
		return this.memory.provider;
	}

	get store(): StoreDefinition {
		if (!this._store) {
			let store = _.mapValues(this.drops, drops => _.sum(_.map(drops, drop => drop.amount)));
			if (!store.energy) store.energy = 0;
			this._store = store as StoreDefinition;
		}
		return this._store;
	}

	get storeCapacity(): number {
		if (this.memory.storeCapacity) {
			return this.memory.storeCapacity;
		} else {
			return 999;
		}
	}

	init(): void {
		if (this.provider) {
			this.colony.logisticsGroup.provide(this);
		} else {
			this.colony.logisticsGroup.request(this);
		}
	}

	run(): void {
		if (this.provider && _.sum(this.store) == 0) {
			this.remove();
		}
	}


}

