import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {PowerDrillOverlord} from '../../overlords/powerMining/PowerDrill';
import {Pathing} from "../../movement/Pathing";
import {calculateFormationStrength} from "../../utilities/creepUtils";
import {PowerHaulingOverlord} from "../../overlords/powerMining/PowerHauler";
import {log} from "../../console/log";


interface DirectivePowerMineMemory extends FlagMemory {
	totalResources?: number;
	/*
		0: init
		1: mining started
		2: mining near done, hauling started
		3: mining done
		4: hauling picking is complete
	 */
	state: number;
}


/**
 * PowerMining directive: kills power banks and collects the resources.
 */
@profile
export class DirectivePowerMine extends Directive {

	static directiveName = 'powerMine';
	static color = COLOR_YELLOW;
	static secondaryColor = COLOR_RED;

	private _powerBank: StructurePowerBank | undefined;
	private _drops: { [resourceType: string]: Resource[] };

	memory: DirectivePowerMineMemory;

	constructor(flag: Flag) {
		super(flag);
		this._powerBank = this.room != undefined ? this.pos.lookForStructure(STRUCTURE_POWER_BANK) as StructurePowerBank : undefined;
		this.memory.state = 0;
	}

	spawnMoarOverlords() {
		if (this.memory.state < 3 && this.powerBank) {
			this.overlords.powerMine = new PowerDrillOverlord(this);
		}
		if (this.memory.state > 1) {
			this.overlords.powerHaul = new PowerHaulingOverlord(this);
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
			return 0;
		} else {
			let tally = calculateFormationStrength(this.powerBank.pos.findInRange(FIND_MY_CREEPS, 4));
			let healStrength: number = tally.heal * HEAL_POWER || 0;
			let attackStrength: number = tally.attack * ATTACK_POWER || 0;
			// PB have 50% hitback, avg damage is attack strength if its enough healing, otherwise healing
			let avgDamagePerTick = Math.min(attackStrength, healStrength*2);
			return this.powerBank.hits / avgDamagePerTick;
		}
	}


	manageState() {
		let currentState = this.memory.state;
		if (currentState == 0 && this.powerBank && this.powerBank.hits < this.powerBank.hitsMax) {
			if (this.powerBank.pos.findInRange(FIND_MY_CREEPS, 3).length == 0) {
				// Power bank is damage but we didn't mine it
				log.alert(`Power bank mining ${this.print} failed as someone else is mining this location`);
				this.remove();
			} else {
				// Set to mining started
				this.memory.state = 1;
			}
		} else if (currentState == 1 && this.room && (!this.powerBank || this.powerBank.hits < 500000)) {
			log.info('Activating spawning haulers for power mining in room ' + this.pos.roomName);
			this.memory.state = 2;
		} else if ((currentState == 1 || currentState == 2) && this.room && !this.powerBank && !this.hasDrops) {
			log.error(`WE FAILED. SORRY CHIEF, COULDN'T FINISHED POWER MINING IN ${this.room} DELETING CREEP at time: ${Game.time}`);
			this.remove();
		} else if (currentState == 2 && this.room && (!this.powerBank)) {
			log.alert(`Mining is complete for ${this.print} in ${this.room.print} at time ${Game.time}`);
			this.memory.state = 3;
			// TODO reassign them to guard the bank
			delete this.overlords["powerMine"];
			this._powerBank = undefined; // This might be fluff
		} else if (currentState == 3 && this.room && !this.hasDrops) {
			// Hauler pickup is now complete
			log.alert(`Hauler pickup is complete for ${this.print} in ${this.room.print} at time ${Game.time}`);
			this.memory.state = 4;
			// TODO  Stop spawning haulers
		} else if (currentState == 4 && this.overlords.powerHaul && (this.overlords.powerHaul as PowerHaulingOverlord).checkIfStillCarryingPower() == undefined) {
			log.alert(`Hauling complete for ${this.print} at time ${Game.time}`);
			this.remove();
		} else {
			log.debug(`Power mining ${this.print} is in state ${currentState}`);
		}
	}

	init(): void {
		this.alert(`PowerMine directive active`);
	}

	run(): void {
		if (Game.time % 5 == 0) {
			this.manageState();
		}
	}
}

