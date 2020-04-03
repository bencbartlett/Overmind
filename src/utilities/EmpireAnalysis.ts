import {getAllColonies} from '../Colony';
import {DirectiveSKOutpost} from '../directives/colony/outpostSK';
import {profile} from '../profiler/decorator';

/**
 * Empire: Utilities on analyzing the overall empire
 */
@profile
export class EmpireAnalysis {

	static empireMineralDistribution(): { [mineralType: string]: number } {
		const colonies = getAllColonies();
		const minedSKRooms = DirectiveSKOutpost.find(Object.values(Game.flags));

		const mineralDistribution: { [mineralType: string]: number } = {};

		for (const colony of colonies) {
			const mineral = colony.room.find(FIND_MINERALS)[0];
			if (!mineralDistribution[mineral.mineralType]) {
				mineralDistribution[mineral.mineralType] = 0;
			}
			mineralDistribution[mineral.mineralType] += 1;
		}

		for (const skRoomFlag of minedSKRooms) {
			if (!skRoomFlag.room) {
				continue;
			}
			const mineral = skRoomFlag.room.find(FIND_MINERALS)[0];
			if (!mineralDistribution[mineral.mineralType]) {
				mineralDistribution[mineral.mineralType] = 0;
			}
			mineralDistribution[mineral.mineralType] += 1;
		}
		return mineralDistribution;
	}
}
