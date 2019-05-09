const RL_ACTION_SEGMENT = 70;

export class ActionParser {


	/**
	 * Determine the list of actions for each Zerg to perform
	 */
	static parseActions(actions: { [zergName: string]: any }) {
		// todo

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

	}

}

