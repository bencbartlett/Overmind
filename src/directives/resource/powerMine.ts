import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {PowerDrillOverlord} from '../../overlords/powerMining/PowerDrill';
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
	static requiredRCL = 7;

	private _powerBank: StructurePowerBank | undefined;
	private _drops: { [resourceType: string]: Resource[] };

	memory: DirectivePowerMineMemory;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= DirectivePowerMine.requiredRCL);
		this._powerBank = this.powerBank;
		this.memory.state = this.memory.state || 0;
	}

	spawnMoarOverlords() {
		if (this.memory.state < 3) {
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
		log.debug(`Managing state ${currentState} of directive ${this.print} with PB ${this.powerBank}`);
		if (currentState == 0 && this.powerBank && this.powerBank.hits < this.powerBank.hitsMax) {
			if (this.powerBank.pos.findInRange(FIND_MY_CREEPS, 3).length == 0 && this.powerBank.pos.findInRange(FIND_HOSTILE_CREEPS, 3).length > 0) {
				// Power bank is damage but we didn't mine it
				Game.notify(`Power bank mining ${this.print} failed as someone else is mining this location.`);
				log.alert(`Power bank mining ${this.print} failed as someone else is mining this location.`);
				this.remove();
			} else {
				// Set to mining started
				this.memory.state = 1;
			}
		} else if ((currentState == 0 || currentState == 1) && this.room && (!this.powerBank || this.powerBank.hits < 500000)) {
			Game.notify('Activating spawning haulers for power mining in room ' + this.pos.roomName);
			log.info('Activating spawning haulers for power mining in room ' + this.pos.roomName);
			this.memory.state = 2;
		} else if ((currentState == 0 || currentState == 1 || currentState == 2) && this.room && this.pos.isVisible && !this.powerBank) {
			if (!this.hasDrops) {
				// TODO this had an error where it triggered incorrectly
				Game.notify(`WE FAILED. SORRY CHIEF, COULDN'T FINISH POWER MINING IN ${this.print} DELETING Directive at time ${Game.time}`);
				log.error(`WE FAILED. SORRY CHIEF, COULDN'T FINISH POWER MINING IN ${this.room} DELETING Directive at time: ${Game.time}`);
				this.remove();
			} else {
				// If somehow there is no bank but there is drops where bank was
				this.memory.state = 3;
			}
		} else if (currentState == 2 && this.room && (!this.powerBank) && this.hasDrops) {
			Game.notify(`Mining is complete for ${this.print} in ${this.room.print} at time ${Game.time}`);
			log.alert(`Mining is complete for ${this.print} in ${this.room.print} at time ${Game.time}`);
			this.memory.state = 3;
			// TODO reassign them to guard the bank
			delete this.overlords["powerMine"];
			this._powerBank = undefined; // This might be fluff
		} else if (currentState == 3 && this.room && this.pos.isVisible && !this.hasDrops) {
			Game.notify(`Hauler pickup is complete for ${this.print} in ${this.room.print} at time ${Game.time}`);
			// Hauler pickup is now complete
			log.alert(`Hauler pickup is complete for ${this.print} in ${this.room.print} at time ${Game.time}`);
			this.memory.state = 4;
			// TODO  Stop spawning haulers
		} else if (currentState == 4 && this.overlords.powerHaul && (this.overlords.powerHaul as PowerHaulingOverlord).checkIfStillCarryingPower() == undefined) {
			// TODO Doesn't give enough time to pick up power
			Game.notify(`Hauling complete for ${this.print} at time ${Game.time}. Final power collected was ${(this.overlords.powerHaul as PowerHaulingOverlord).totalCollected} out of ${this.memory.totalResources}`);
			log.alert(`Hauling complete for ${this.print} at time ${Game.time}. Final power collected was ${(this.overlords.powerHaul as PowerHaulingOverlord).totalCollected} out of ${this.memory.totalResources}`);
			this.remove();
		} else {
			log.debug(`Power mining ${this.print} is in state ${currentState}`);
			// Todo this isn't error but needs other stuff
		}
	}

	init(): void {
		this.alert(`PowerMine directive active`);
	}

	run(): void {
		if (Game.time % 9 == 0) {
			this.manageState();
		}
	}
}

