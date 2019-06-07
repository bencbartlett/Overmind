import {RL_TRAINING_VERBOSITY} from '../~settings';

export class ActionParser {

	/**
	 * Determine the list of actions for each Zerg to perform
	 */
	static parseActions(serializedActions: { [creepName: string]: RLAction[] }) {
		for (const creepName in serializedActions) {
			const creep = Game.creeps[creepName];
			if (!creep) {
				console.log(`No creep with name ${creepName}!`);
			} else {
				for (const action of serializedActions[creepName]) {
					const [command, id] = action;
					const targ: RoomObject | null = typeof id == 'string' ? Game.getObjectById(id) : null;
					switch (command) {
						case 'move':
							creep.move(<DirectionConstant>id);
							break;
						case 'moveTo':
							if (targ) creep.moveTo(targ);
							break;
						case 'attack':
							if (targ) creep.attack(<Creep>targ);
							break;
						case 'rangedAttack':
							if (targ) creep.rangedAttack(<Creep>targ);
							break;
						case 'rangedMassAttack':
							creep.rangedMassAttack();
							break;
						case 'heal':
							if (targ) {
								creep.heal(<Creep>targ);
							} else if (typeof id != 'string') {
								creep.heal(creep);
							}
							break;
						case 'rangedHeal':
							if (targ) creep.rangedHeal(<Creep>targ);
							break;
						default:
							console.log(`Invalid command: ${command}!`);
							break;
					}
				}
			}
		}
	}

	static logState() {
		console.log(`[${Game.time}] My creeps: `, _.map(Game.creeps, creep => creep.name + ' ' + creep.pos));
		if (Memory.reinforcementLearning) {
			console.log(`[${Game.time}] Memory.reinforcementLearning: ${JSON.stringify(Memory.reinforcementLearning)}`);
		}
	}

	/**
	 * Read action commands from the designated memory segment, parse them, and run them
	 */
	static run() {

		// Parse actions
		if (Memory.reinforcementLearning) {
			ActionParser.parseActions(Memory.reinforcementLearning);
		}

		// Log state according to verbosity
		if (RL_TRAINING_VERBOSITY == 0) {
			// no logigng
		} else if (RL_TRAINING_VERBOSITY == 1) {
			if (Game.time % 100 == 0 || Game.time % 100 == 1) {
				this.logState();
			}
		} else if (RL_TRAINING_VERBOSITY == 2) {
			this.logState();
		}

		// Clear reinforcementLearning block when done
		Memory.reinforcementLearning = {};

	}

}

