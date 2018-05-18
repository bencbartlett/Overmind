// Some migration code that gradually reboots all room planners to account for new changes
import {log} from '../lib/logger/log';
import {Colony} from '../Colony';

export function migrate_02X_03X() {
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
		} else {
			log.alert(`Backwards-incompatible changes from v0.2.x -> v0.3.x successfully patched.\n` +
					  `You may disable this migration code now.`);
		}
	}
}
