import {profile} from '../profiler/decorator';
import {log} from "../console/log";
import {Overseer} from "../Overseer";
import {getAllColonies} from "../Colony";
import {Directive} from "../directives/Directive";
import {DirectiveSKOutpost} from "../directives/colony/outpostSK";

export const ROOMTYPE_SOURCEKEEPER = 'SK';
export const ROOMTYPE_CORE = 'CORE';
export const ROOMTYPE_CONTROLLER = 'CTRL';
export const ROOMTYPE_ALLEY = 'ALLEY';

/**
 * Empire: Utilities on analyzing the overall empire
 */
@profile
export class EmpireAnalysis {

	static empireMineralDistribution(): {[mineralType: string]: number} {
		let colonies = getAllColonies();
		let minedSKRooms = DirectiveSKOutpost.find(Object.values(Game.flags));

		const mineralDistribution: {[mineralType: string]: number} = {};

		for (let colony of colonies) {
			const mineral = colony.room.find(FIND_MINERALS)[0];
			if (!mineralDistribution[mineral.mineralType]) {
				mineralDistribution[mineral.mineralType] = 0;
			}
			mineralDistribution[mineral.mineralType] += 1;
		}

		for (let skRoomFlag of minedSKRooms) {
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
