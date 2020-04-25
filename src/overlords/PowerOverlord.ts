import {Colony} from '../Colony';
import {log} from '../console/log';
import {profile} from '../profiler/decorator';
import {CombatZerg} from '../zerg/CombatZerg';
import {PowerZerg} from '../zerg/PowerZerg';
import {PowerZergOperator} from '../zerg/PowerZergOperator';
import {Zerg} from '../zerg/Zerg';
import {Overlord, OverlordInitializer, OverlordMemory, ZergOptions} from './Overlord';


export interface PowerOverlordMemory extends OverlordMemory {
	[MEM.TICK]: number;
}

export interface PowerOverlordOptions {

}

const getDefaultPowerOverlordMemory: () => PowerOverlordMemory = () => ({
	[MEM.TICK]: Game.time,
});

/**
 * CombatOverlords extend the base Overlord class to provide additional combat-specific behavior
 */
@profile
export abstract class PowerOverlord extends Overlord {

	memory: PowerOverlordMemory;
	requiredRCL: number; // default required RCL

	private _powerCreeps: { [roleName: string]: PowerCreep[] };
	private _powerZerg: { [roleName: string]: PowerZerg[] };

	constructor(initializer: OverlordInitializer | Colony, name: string, priority: number) {
		super(initializer, name, priority, getDefaultPowerOverlordMemory);
		this._powerCreeps = {};
	}

	get age(): number {
		return Game.time - this.memory[MEM.TICK];
	}

	protected zerg(role: string, opts: ZergOptions = {}): Zerg[] {
		log.error(`${this.print}: cannot call PowerOverlord.zerg()!`);
		return [];
	}

	protected combatZerg(role: string, opts: ZergOptions = {}): CombatZerg[] {
		log.error(`${this.print}: cannot call PowerOverlord.combatZerg()!`);
		return [];
	}

	/**
	 * Wraps all powerCreeps of a given role to PowerZerg objects and updates the contents in future ticks to avoid
	 * having to explicitly refresh groups of PowerZerg
	 */
	protected powerZerg(role: string, opts: ZergOptions = {}): PowerZerg[] {
		if (!this._powerZerg[role]) {
			this._powerZerg[role] = [];
			this.synchronizePowerZerg(role, opts.notifyWhenAttacked);
		}
		return this._powerZerg[role];
	}

	private synchronizePowerZerg(role: string, notifyWhenAttacked?: boolean): void {
		// Synchronize the corresponding sets of Zerg
		const zergNames = _.zipObject(_.map(this._powerZerg[role] || [],
											zerg => [zerg.name, true])) as { [name: string]: boolean };
		const creepNames = _.zipObject(_.map(this._powerCreeps[role] || [],
											 creep => [creep.name, true])) as { [name: string]: boolean };
		// Add new creeps which aren't in the _zerg record
		for (const creep of this._powerCreeps[role] || []) {
			if (!zergNames[creep.name]) {
				if (Overmind.powerZerg[creep.name]) {
					this._powerZerg[role].push(Overmind.powerZerg[creep.name]);
				} else {
					switch (creep.className) {
						case POWER_CLASS.OPERATOR:
							this._powerZerg[role].push(new PowerZergOperator(creep, notifyWhenAttacked));
							break;
						default:
							log.error(`NOT IMPLEMENTED`);
							break;
					}
				}
			}
		}
		// Remove dead/reassigned creeps from the _zerg record
		const removeZergNames: string[] = [];
		for (const powerZerg of this._powerZerg[role]) {
			if (!creepNames[powerZerg.name]) {
				removeZergNames.push(powerZerg.name);
			}
		}
		_.remove(this._powerZerg[role], deadZerg => removeZergNames.includes(deadZerg.name));
	}

}

