import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {isStoreStructure} from '../../declarations/typeGuards';
import {PowerDrillOverlord} from '../../overlords/powerMining/PowerDrill';
import {Pathing} from "../../movement/Pathing";
import {calculateFormationStrength} from "../../utilities/creepUtils";
import {PowerHaulingOverlord} from "../../overlords/powerMining/PowerHauler";


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

	expectedSpawnTime = 200;
	private _powerBank: StructurePowerBank | undefined;
	private _drops: { [resourceType: string]: Resource[] };

	memory: DirectivePowerMineMemory;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.powerMine = new PowerDrillOverlord(this);
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

	/**
	 * Total amount of resources remaining to be transported; cached into memory in case room loses visibility
	 */
	get totalResources(): number {
		if (this.memory.totalResources == undefined) {
			return 5000; // pick some non-zero number so that powerMiners will spawn
		}
		if (this.pos.isVisible) {
			this.memory.totalResources = this._powerBank ? this._powerBank.power : this.memory.totalResources; // update total amount remaining
		}
		return this.memory.totalResources;
	}

	calculateRemainingLifespan() {
		if (!this.room) {
			return undefined;
		} else if (this._powerBank == undefined) {
			// Power Bank is gone
			return 0;
		} else {
			let tally = calculateFormationStrength(this._powerBank.pos.findInRange(FIND_MY_CREEPS, 4));
			let healStrength: number = tally.heal * HEAL_POWER || 0;
			let attackStrength: number = tally.attack * ATTACK_POWER || 0;
			// PB have 50% hitback, avg damage is attack strength if its enough healing, otherwise healing
			let avgDamagePerTick = Math.min(attackStrength, healStrength*2);
			return this._powerBank.hits / avgDamagePerTick;
		}
	}

	spawnHaulers() {

		if (this.room && (!this._powerBank || (this.calculateRemainingLifespan()! < Pathing.distance(this.colony.pos, this.flag.pos) + this.expectedSpawnTime))) {
			this.overlords.powerHaul = new PowerHaulingOverlord(this);
		}
	}



	init(): void {
		this.alert(`PowerMine directive active`);
	}



	run(): void {

	}

}

