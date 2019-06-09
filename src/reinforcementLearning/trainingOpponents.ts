import {NeuralZerg} from '../zerg/NeuralZerg';

export class TrainingOpponents {

	/**
	 * Simple combat behavior to train against. Every creep just chases the nearest opponent and attacks them.
	 */
	static simpleCombat(zerg: NeuralZerg) {
		const closestOpponent = zerg.pos.findClosestByRange(zerg.room.hostiles);
		if (closestOpponent) {
			zerg.creep.moveTo(closestOpponent);
			zerg.attack(closestOpponent);
			zerg.rangedAttack(closestOpponent);
			zerg.heal(zerg);
		}
	}

	/**
	 * Stupid combat behavior. Moves in a random direction and attacks a random target in range if combat is allowed
	 */
	static stupidCombat(zerg: NeuralZerg, allowAttack = false, allowHeal = false) {
		const direction = _.random(1, 8) as DirectionConstant;
		zerg.move(direction);

		if (allowAttack) {
			const meleeTarget = _.sample(zerg.pos.findInRange(zerg.room.hostiles, 1));
			if (meleeTarget) zerg.attack(meleeTarget);
			const rangedTarget = _.sample(zerg.pos.findInRange(zerg.room.hostiles, 3));
			if (rangedTarget) zerg.rangedAttack(rangedTarget);
		}
		if (allowHeal) {
			zerg.heal(zerg);
		}
	}

}
