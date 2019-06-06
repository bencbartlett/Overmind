// const RL_ACTION_SEGMENT = 70;


type AllowableAction =
	['move', DirectionConstant]
	| ['moveTo', string]
	| ['attack', string]
	| ['rangedAttack', string]
	| ['rangedMassAttack', null]
	| ['heal', string]
	| ['rangedHeal', string];

export class ActionParser {

	/**
	 * Determine the list of actions for each Zerg to perform
	 */
	static parseActions(serializedActions: { [creepName: string]: AllowableAction[] }) {

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
							if (targ) creep.heal(<Creep>targ);
							break;
						case 'rangedHeal':
							if (targ) creep.rangedHeal(<Creep>targ);
							break;
					}
				}
			}
		}

	}

	/**
	 * Read action commands from the designated memory segment, parse them, and run them
	 */
	static run() {

		// const raw = RawMemory.segments[RL_ACTION_SEGMENT];
		//
		// if (raw != undefined && raw != '') {
		// 	const actions = JSON.parse(raw);
		// 	ActionParser.parseActions(actions);
		// }
		//
		// RawMemory.setActiveSegments([RL_ACTION_SEGMENT]); // keep this segment requested during training
		console.log(`[${Game.time}] My creeps: `, _.map(Game.creeps, creep => creep.name + ' ' + creep.pos));

		if (Memory.reinforcementLearning) {
			console.log(`[${Game.time}] Memory.reinforcementLearning: ${JSON.stringify(Memory.reinforcementLearning)}`);
			ActionParser.parseActions(Memory.reinforcementLearning);
		}

	}

}

