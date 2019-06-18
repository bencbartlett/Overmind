/*

 _____  _    _ _______  ______ _______ _____ __   _ ______
|     |  \  /  |______ |_____/ |  |  |   |   | \  | |     \
|_____|   \/   |______ |    \_ |  |  | __|__ |  \_| |_____/
....... R E I N F O R C E M E N T   L E A R N I N G .......

*/

import {NeuralZerg} from '../zerg/NeuralZerg';
import {RL_TRAINING_VERBOSITY} from '../~settings';
import {TrainingOpponents} from './trainingOpponents';

export const RL_ACTION_SEGMENT = 70;

export type RLAction =
	['move', DirectionConstant]
	| ['goTo', string]
	| ['attack', string]
	| ['rangedAttack', string]
	| ['rangedMassAttack', null]
	| ['heal', string]
	| ['rangedHeal', string]
	| ['approachHostiles', null]
	| ['avoidHostiles', null]
	| ['approachAllies', null]
	| ['avoidAllies', null]
	| ['maneuver', [string[], string[]]]
	| ['noop', null];

/**
 * The ActionParser provides a line of direct interaction for the external Python optimizers to control
 * creep actions via the Memory.reinforcementLearning object.
 */
export class ActionParser {

	/**
	 * Parse an individual action from its serialized format and command the actor to execute it.
	 * Returns whether the action was valid.
	 */
	private static parseAction(actor: NeuralZerg, action: RLAction, autoEngage = true): boolean {

		const command: string = action[0];
		const predicate: any = action[1];
		const targ: RoomObject | null = typeof predicate == 'string' ? Game.getObjectById(predicate) : null;

		switch (command) {
			case 'move':
				actor.move(<DirectionConstant>predicate);
				break;
			case 'goTo':
				if (targ) actor.goTo(targ);
				break;
			case 'attack':
				if (targ) actor.attack(<Creep>targ);
				break;
			case 'rangedAttack':
				if (targ) actor.rangedAttack(<Creep>targ);
				break;
			case 'rangedMassAttack':
				actor.rangedMassAttack();
				break;
			case 'heal':
				if (targ) {
					actor.heal(<Creep>targ);
				} else if (typeof predicate != 'string') {
					actor.heal(actor);
				}
				break;
			case 'rangedHeal':
				if (targ) actor.rangedHeal(<Creep>targ);
				break;
			case 'approachHostiles':
				actor.approachHostiles();
				break;
			case 'avoidHostiles':
				actor.avoidHostiles();
				break;
			case 'approachAllies':
				actor.approachAllies();
				break;
			case 'avoidAllies':
				actor.avoidAllies();
				break;
			case 'maneuver':
				const approachNames: string[] = predicate[0];
				const avoidNames: string[] = predicate[1];
				const approachTargs = _.map(approachNames, name => Game.creeps[name]);
				const avoidTargs = _.map(avoidNames, name => Game.creeps[name]);
				actor.maneuver(approachTargs, avoidTargs);
				break;
			case 'noop':
				break;
			default:
				console.log(`[${Game.time}] Invalid command: ${command}!`);
				return false;
		}
		if (autoEngage) {
			actor.autoEngage();
		}
		return true;
	}

	/**
	 * Determine the list of actions for each Zerg to perform
	 */
	private static parseActions(actors: { [creepName: string]: NeuralZerg },
								serializedActions: { [creepName: string]: RLAction[] }) {

		const receivedOrders: { [creepName: string]: boolean } = _.mapValues(actors, actor => false);

		// Deserialize the actions for each actor
		for (const creepName in serializedActions) {

			const creep = actors[creepName] as NeuralZerg | undefined;

			if (!creep) {
				console.log(`No creep with name ${creepName}!`);
				continue;
			}

			// Parse and execute each action, recording whether it was valid
			for (const action of serializedActions[creepName]) {
				const validAction = ActionParser.parseAction(creep, action);
				if (validAction) {
					receivedOrders[creepName] = true;
				}
			}

		}

		// Ensure each actor was given an order (possibly noop)
		for (const actorName in actors) {
			if (!receivedOrders[actorName]) {
				console.log(`[${Game.time}] Actor with name ${actorName} did not receive an order this tick!`);
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
	private static getAllActors(): { [creepName: string]: NeuralZerg } {
		return _.mapValues(Game.creeps, creep => new NeuralZerg(creep));
	}

	/**
	 * Read action commands from the designated memory segment, parse them, and run them
	 */
	static run() {

		// Wrap all creep as NeuralZerg and partition actors into controllable and uncontrollable (scripted) sets
		const allActors = ActionParser.getAllActors();

		const controllableActors: { [creepName: string]: NeuralZerg } = {};
		const uncontrollableActors: { [creepName: string]: NeuralZerg } = {};

		for (const name in allActors) {
			const actor = allActors[name];
			if (allActors[name].isBot) {
				uncontrollableActors[name] = actor;
			} else {
				controllableActors[name] = actor;
			}
		}

		// Parse memory and relay actions to controllable actors
		const raw = RawMemory.segments[RL_ACTION_SEGMENT];
		if (raw != undefined && raw != '') {
			const actions = JSON.parse(raw);
			ActionParser.parseActions(controllableActors, actions);
		} else {
			if (_.size(controllableActors) > 0) {
				console.log(`[${Game.time}]: No actions received!`);
			}
		}

		// Run uncontrollable actors on a script
		for (const name in uncontrollableActors) {
			const bot = uncontrollableActors[name];
			// TrainingOpponents.stupidCombat(bot);
			TrainingOpponents.simpleCombat(bot);
		}

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

		// Clear the segment and keep it requested
		RawMemory.segments[RL_ACTION_SEGMENT] = '';
		RawMemory.setActiveSegments([RL_ACTION_SEGMENT]);

	}

}

