// Sandbox code: lets you try out random stuff at the end of main loop

import {log} from './lib/logger/log';
import {Colony} from './Colony';

export function sandbox() {
	try {
		// Some migration code that gradually reboots all room planners to account for new changes
		for (let name in Overmind.Colonies) {
			let colony = Overmind.Colonies[name] as Colony;
			let lastBuilt = colony.roomPlanner.memory.lastGenerated;
			// Reboot colony room planners one at a time every 3 ticks
			if (!lastBuilt) {
				if (Game.time % 100 == 3 * colony.id) {
					// Delete all white/white routing hints from memory
					colony.roomPlanner.memory.savedFlags = _.filter(colony.roomPlanner.memory.savedFlags,
																	flag => flag.secondaryColor != COLOR_WHITE);
					colony.roomPlanner.active = true;
					log.alert(`Rebooting roomPlanner for colony ${colony.name}!`);
				} else if (Game.time % 100 == 3 * colony.id + 1) {
					colony.roomPlanner.finalize(true);
				}
			}
		}
	} catch (e) {
		log.error(e);
	}
}