import {profile} from '../profiler/decorator';
import {PowerZerg} from './PowerZerg';


/**
 * Wrapper for the operator class of power creeps. Contains wrapped methods for all powers this creep can do.
 */
@profile
export class PowerZergOperator extends PowerZerg {

	className: POWER_CLASS['OPERATOR'];

	/**
	 * Increase max limit of energy that can be used for upgrading a Level 8 controller each tick by 10/20/30/40/50
	 * energy units. Effect duration 1000 ticks. Cooldown 800 ticks. Range 3 squares. Consumes 200 ops resource units.
	 * Required creep level: 20/21/22/23/24.
	 */
	operateController(controller: StructureController): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_CONTROLLER, controller);
	}

	/**
	 * 	Instantly fill 20/40/60/80/100% of all extensions in the room using energy from the target structure
	 * 	(container, storage, or terminal). Cooldown 50 ticks.
	 * 	Range 3 squares. Consumes 2 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	operateExtension(energySource: StructureStorage | StructureTerminal | StructureContainer): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_EXTENSION, energySource);
	}

	/**
	 * Set the level of the factory to the level of the power. This action is permanent, it cannot be undone, and
	 * another power level cannot be applied. Apply the same power again to renew its effect.
	 * Effect duration 1000 ticks. Cooldown 800 ticks. Range 3 squares. Consumes 100 ops resource units.
	 * Required creep level: 0/2/7/14/22.
	 */
	operateFactory(factory: StructureFactory): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_FACTORY, factory);
	}

	/**
	 * Increase reaction amount by 2/4/6/8/10 units. Effect duration 1000 ticks. Cooldown 50 ticks.
	 * Range 3 squares. Consumes 10 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	operateLab(lab: StructureLab): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_LAB, lab);
	}

	/**
	 * Grant unlimited range. Effect duration 200/400/600/800/1000 ticks. Cooldown 400 ticks.
	 * Range 3 squares. Consumes 10 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	operateObserver(observer: StructureObserver): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_OBSERVER, observer);
	}

	/**
	 * 	Increase power processing speed of a Power Spawn by 1/2/3/4/5 units per tick. Effect duration 1000 ticks.
	 * 	Cooldown 800 ticks. Range 3 squares. Consumes 200 ops resource units. Required creep level: 10/11/12/14/22.
	 */
	operatePowerSpawn(powerSpawn: StructurePowerSpawn): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_POWER, powerSpawn);
	}

	/**
	 * Reduce spawn time by 10/30/50/65/80%. Effect duration 1000 ticks. Cooldown 300 ticks.
	 * Range 3 squares. Consumes 100 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	operateSpawn(spawn: StructureSpawn): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_SPAWN, spawn);
	}

	/**
	 * Increase capacity by 500K/1M/2M/4M/7M units. Effect duration 1000 ticks. Cooldown 800 ticks.
	 * Range 3 squares. Consumes 100 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	operateStorage(storage: StructureStorage): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_STORAGE, storage);
	}

	/**
	 * Decrease transfer energy cost and cooldown by 10/20/30/40/50%. Effect duration 1000 ticks. Cooldown 500 ticks.
	 * Range 3 squares. Consumes 100 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	operateTerminal(terminal: StructureTerminal): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_TERMINAL, terminal);
	}

	/**
	 * Increase damage, repair and heal amount by 10/20/30/40/50%. Effect duration 100 ticks. Cooldown 10 ticks.
	 * Range 3 squares. Consumes 10 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	operateTower(tower: StructureTower): ScreepsReturnCode {
		return this.creep.usePower(PWR_OPERATE_TOWER, tower);
	}

	/**
	 * Pause energy regeneration. Effect duration 100/200/300/400/500 ticks. Cooldown 100 ticks.
	 * Range 3 squares. Consumes 100 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	disruptSource(source: Source): ScreepsReturnCode {
		return this.creep.usePower(PWR_DISRUPT_SOURCE, source);
	}

	/**
	 * Pause spawning process. Effect duration 1/2/3/4/5 ticks. Cooldown 5 ticks. Range 20 squares.
	 * Consumes 10 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	disruptSpawn(spawn: StructureSpawn): ScreepsReturnCode {
		return this.creep.usePower(PWR_DISRUPT_SPAWN, spawn);
	}

	/**
	 * Block withdrawing or using resources from the terminal. Effect duration 10 ticks. Cooldown 8 ticks.
	 * Range 50 squares. Consumes 50/40/30/20/10 ops resource units. Required creep level: 20/21/22/23/24.
	 */
	disruptTerminal(terminal: StructureTerminal): ScreepsReturnCode {
		return this.creep.usePower(PWR_DISRUPT_TERMINAL, terminal);
	}

	/**
	 * Reduce effectiveness by 10/20/30/40/50%. Effect duration 5 ticks. No cooldown.
	 * Range 50 squares. Consumes 10 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	disruptTower(tower: StructureTower): ScreepsReturnCode {
		return this.creep.usePower(PWR_DISRUPT_TOWER, tower);
	}

	/**
	 * Regenerate 2/4/6/8/10 mineral units in a deposit every 10 ticks. Effect duration 100 ticks.
	 * Cooldown 100 ticks. Range 3 squares. Required creep level: 10/11/12/14/22.
	 */
	regenMineral(mineral: Mineral): ScreepsReturnCode {
		return this.creep.usePower(PWR_REGEN_MINERAL, mineral);
	}

	/**
	 * Regenerate 50/100/150/200/250 energy units in a source every 15 ticks. Effect duration 300 ticks.
	 * Cooldown 100 ticks. Range 3 squares. Required creep level: 10/11/12/14/22.
	 */
	regenSource(source: Source): ScreepsReturnCode {
		return this.creep.usePower(PWR_REGEN_SOURCE, source);
	}

	/**
	 * Make a wall or rampart tile invulnerable to all creep attacks and powers. Effect duration 1/2/3/4/5 ticks.
	 * Cooldown 5 ticks. Range 3 squares. Consumes 5 ops resource units. Required creep level: 0/2/7/14/22.
	 */
	fortify(barrier: StructureRampart | StructureWall): ScreepsReturnCode {
		return this.creep.usePower(PWR_FORTIFY, barrier);
	}

	/**
	 * Create a temporary non-repairable rampart with 5K/10K/15K/20K/25K hits on the same position as the PowerCreep.
	 * Cannot be used on top of another rampart. Consumes 100 energy resource units. Effect duration 50 ticks.
	 * Cooldown 20 ticks. Required creep level: 0/2/7/14/22.
	 */
	shield(): ScreepsReturnCode {
		return this.creep.usePower(PWR_SHIELD);
	}

}
