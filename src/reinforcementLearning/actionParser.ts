import {RL_TRAINING_VERBOSITY} from '../~settings';

export const RL_ACTION_SEGMENT = 70;

export type RLAction =
	['move', DirectionConstant]
	| ['moveTo', string]
	| ['attack', string]
	| ['rangedAttack', string]
	| ['rangedMassAttack', null]
	| ['heal', string]
	| ['rangedHeal', string];

/**
 * The ActionParser provides a line of direct interaction for the external Python optimizers to control
 * creep actions via the Memory.reinforcementLearning object.
 */
export class ActionParser {

	/**
	 * Determine the list of actions for each Zerg to perform
	 */
	private static parseActions(serializedActions: { [creepName: string]: RLAction[] }) {
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

	/**
	 * Periodic logging functions that are used to describe state of training map and identify bugs
	 */
	private static logState(contents: string) {
		console.log(`[${Game.time}] My creeps: `, _.map(Game.creeps, creep => creep.name + ' ' + creep.pos));
		if (Memory.reinforcementLearning) {
			console.log(`[${Game.time}] RL Segment: ${contents}`);
		}
	}

	/**
	 * Wraps all creeps as Zerg
	 */
	private static wrapZerg(useCombatZerg = true) {

	}

	/**
	 * Read action commands from the designated memory segment, parse them, and run them
	 */
	static run() {

		const raw = RawMemory.segments[RL_ACTION_SEGMENT];

		if (raw != undefined && raw != '') {
			const actions = JSON.parse(raw);
			ActionParser.parseActions(actions);
		}

		RawMemory.setActiveSegments([RL_ACTION_SEGMENT]); // keep this segment requested during training

		// Log state according to verbosity
		if (RL_TRAINING_VERBOSITY == 0) {
			// no logigng
		} else if (RL_TRAINING_VERBOSITY == 1) {
			if (Game.time % 100 == 0 || Game.time % 100 == 1) {
				this.logState(raw);
			}
		} else if (RL_TRAINING_VERBOSITY == 2) {
			this.logState(raw);
		}

	}

}

