// The Strategist makes high-level game decisions such as choosing when/where to expand and who to harass. It is located
// on Overmind.strategist and is only instantiated if the AI is run in full-auto mode.

import {Mem} from '../memory';
import {Colony, getAllColonies} from '../Colony';
import {DirectiveColonize} from '../directives/colonization/colonize';
import {DirectiveIncubate} from '../directives/colonization/incubate';

interface StrategistMemory {

}

const defaultStrategistMemory: StrategistMemory = {};

export class Strategist {

	memory: StrategistMemory;

	constructor() {
		this.memory = Mem.wrap(Memory, 'strategist', defaultStrategistMemory);
	}

	private chooseNextColonyRoom(): string | undefined {
		let allColonies = getAllColonies();
		// Make sure GCL is sufficient
		if (allColonies.length == Game.gcl.level) {
			return;
		}
		// Generate a list of possible colonies to expand from based on level and whether they are already expanding
		let possibleIncubators: Colony[] = [];
		let possibleColonizers: Colony[] = [];
		for (let colony of allColonies) {
			if (colony.level >= DirectiveIncubate.requiredRCL
				&& _.filter(colony.flags, flag => DirectiveIncubate.filter(flag)).length == 0) {
				possibleIncubators.push(colony);
			}
			if (colony.level >= DirectiveColonize.requiredRCL
				&& _.filter(colony.flags, flag => DirectiveColonize.filter(flag)).length == 0) {
				possibleColonizers.push(colony);
			}
		}
	}


	init(): void {

	}

	run(): void {

	}

}
