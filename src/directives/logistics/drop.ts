import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';


interface DirectiveDropMemory extends FlagMemory {
	amount: number;
}


/**
 * Dropping directive - at early levels transporters should pick up from drops and put them all in a giant pile
 * near the storage position and upgrading position
 */
@profile
export class DirectiveDrop extends Directive {

	static directiveName = 'haul';
	static color = COLOR_GREEN;
	static secondaryColor = COLOR_GREEN;

	private _store: StoreDefinition | undefined;
	private _drops: DropContents;

	memory: DirectiveDropMemory;

	constructor(flag: Flag, pileAmount = 2000) {
		super(flag);
		this.memory.amount = pileAmount;
	}

	spawnMoarOverlords(): void {
		// No overlords associated with this directive
	}

	get targetedBy(): string[] {
		return Overmind.cache.targets[this.ref];
	}

	private get drops(): DropContents {
		if (!this.pos.isVisible) {
			return {} as DropContents;
		}
		if (!this._drops) {
			const drops = this.pos.lookFor(LOOK_RESOURCES);
			this._drops = _.groupBy(drops, drop => drop.resourceType) as DropContents;
		}
		return this._drops;
	}

	get store() {
		if (!this._store) {
			// Merge the "storage" of drops with the store of structure
			const store: StoreDefinition = { energy: 0 } as StoreDefinition;
			// Merge with drops
			for (const resourceType of _.keys(this.drops) as ResourceConstant[]) {
				const totalResourceAmount = _.sum(this.drops[resourceType]!, drop => drop.amount);
				if (store[resourceType]) {
					store[resourceType] += totalResourceAmount;
				} else {
					store[resourceType] = totalResourceAmount;
				}
			}
			this._store = store;
		}
		return this._store;
	}

	refresh(): void {
		super.refresh();
		this._store = undefined;
	}

	private registerEnergyRequests(): void {
		const threshold = 0.75;
		if (this.store.energy < threshold * this.memory.amount) {
			this.colony.logisticsNetwork.requestInput(this);
		}
	}

	init(): void {
		this.registerEnergyRequests();
		this.alert(`Drop directive active - ${_.sum(this.store as StoreContents)}`);
	}

	run(): void {
		const storagePos = this.colony.roomPlanner.storagePos;
		const upgradePos = this.colony.upgradeSite.batteryPos;
		if(storagePos && this.pos.isEqualTo(storagePos)) {
			if (this.colony.hatchery && this.colony.hatchery.batteries.length>0) {
				this.remove();
			}
		} else if (upgradePos && this.pos.isEqualTo(upgradePos)) {
			if (this.colony.upgradeSite.battery) {
				this.remove();
			}
		} else {
			log.error('Drop directive placed on invalid location; removing!');
			this.remove();
		}
	}
}

