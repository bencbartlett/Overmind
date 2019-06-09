import {Movement} from '../movement/Movement';
import {profile} from '../profiler/decorator';
import {CombatZerg} from './CombatZerg';


/**
 * NeuralZerg augments CombatZerg with some additional simplified actions suitable for use in reinforcement learning
 * training scenarios
 */
@profile
export class NeuralZerg extends CombatZerg {

	isBot: boolean;

	constructor(creep: Creep, notifyWhenAttacked = true) {
		super(creep, notifyWhenAttacked);
		this.isBot = creep.name.includes('_BOT');
	}

	approachHostiles() {
		const approach = _.map(this.room.hostiles, hostile => ({pos: hostile.pos, range: 1}));
		return Movement.combatMove(this, approach, []);
	}

	avoidHostiles() {
		const avoid = _.map(this.room.hostiles, hostile => ({pos: hostile.pos, range: 4}));
		return Movement.combatMove(this, [], avoid);
	}

	maneuver(approach: NeuralZerg[], avoid: NeuralZerg[]) {
		// TODO
	}

	autoEngage(combatTarget?: NeuralZerg) {
		const target = combatTarget ? [combatTarget.creep] : undefined;
		// Do standard melee, ranged, and heal actions
		if (this.getActiveBodyparts(ATTACK) > 0) {
			this.autoMelee(target); // Melee should be performed first
		}
		if (this.getActiveBodyparts(RANGED_ATTACK) > 0) {
			this.autoRanged(target);
		}
		if (this.canExecute('heal')) {
			this.autoHeal(this.canExecute('rangedHeal'));
		}
	}

}
