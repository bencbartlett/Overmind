import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {PowerDrillOverlord} from '../../overlords/powerMining/PowerDrill';
import {Pathing} from "../../movement/Pathing";
import {calculateFormationStrength} from "../../utilities/creepUtils";
import {PowerHaulingOverlord} from "../../overlords/powerMining/PowerHauler";
import {log} from "../../console/log";


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

	miningDone:  boolean;
	pickupDone: boolean;
	haulDirectiveCreated: boolean;
	private _powerBank: StructurePowerBank | undefined;
	private _drops: { [resourceType: string]: Resource[] };

	memory: DirectivePowerMineMemory;

	constructor(flag: Flag) {
		super(flag);
		this._powerBank = this.room != undefined ? this.pos.lookForStructure(STRUCTURE_POWER_BANK) as StructurePowerBank : undefined;
	}

	spawnMoarOverlords() {
		if (!this.miningDone && this.powerBank) {
			this.overlords.powerMine = new PowerDrillOverlord(this);
		}
		if (!this.pickupDone) {
			this.spawnHaulers();
		}
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

	get powerBank(): StructurePowerBank | undefined {
		this._powerBank = this._powerBank || this.room ? this.flag.pos.lookForStructure(STRUCTURE_POWER_BANK) as StructurePowerBank : undefined;
		return this._powerBank;
	}

	/**
	 * Total amount of resources remaining to be transported; cached into memory in case room loses visibility
	 */
	get totalResources(): number {
		if (this.memory.totalResources == undefined) {
			return 5000; // pick some non-zero number so that powerMiners will spawn
		}
		if (this.pos.isVisible) {
			this.memory.totalResources = this.powerBank ? this.powerBank.power : this.memory.totalResources; // update total amount remaining
		}
		return this.memory.totalResources;
	}

	calculateRemainingLifespan() {
		if (!this.room) {
			return undefined;
		} else if (this.powerBank == undefined) {
			if (this.miningDone) {
				// Power Bank is gone
				return 0;
			}
		} else {
			let tally = calculateFormationStrength(this.powerBank.pos.findInRange(FIND_MY_CREEPS, 4));
			let healStrength: number = tally.heal * HEAL_POWER || 0;
			let attackStrength: number = tally.attack * ATTACK_POWER || 0;
			// PB have 50% hitback, avg damage is attack strength if its enough healing, otherwise healing
			let avgDamagePerTick = Math.min(attackStrength, healStrength*2);
			return this.powerBank.hits / avgDamagePerTick;
		}
	}

	spawnHaulers() {
		log.info("Checking spawning haulers");
		// Begin checking for spawn haulers at 666 estimated ticks before PB destruction
		if (this.haulDirectiveCreated || this.room && (!this.powerBank || this.powerBank.hits < 500000)) {
			log.debug('Activating spawning haulers for power mining in room ' + this.pos.roomName);
			this.haulDirectiveCreated = true;
			this.overlords.powerHaul = new PowerHaulingOverlord(this);
		}
	}

	setMiningDone(name: string) {
		log.debug("Setting mining done and removing overlord for power mine in room " + this.room + " at time " + Game.time);
		delete this.overlords[name];
		this.miningDone = true;
		this._powerBank = undefined;
	}

	/**
	 * This states when all the power has been picked up. Once all power has been picked up and delivered remove the directive
	 */
	isPickupDone(): boolean {
		if (!this.pickupDone && this.miningDone && this.room && this.pos.isVisible && !this.hasDrops) {
			this.pickupDone = true;
		}
		return this.pickupDone;
	}

	init(): void {
		this.alert(`PowerMine directive active`);
	}

	run(): void {
	}
}

