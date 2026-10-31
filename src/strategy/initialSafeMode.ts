import {Mem} from '../memory/Memory';

export interface ExpansionPlannerMemory {
	startingRoomName?: string;
	firstSafeModeEndsAt?: number;
	firstSafeModeEnded?: boolean;
}

export const defaultExpansionPlannerMemory: ExpansionPlannerMemory = {};

export function isInitialStartingRoomSafeModeActive(): boolean {
	const memory = Mem.wrap(Memory, 'expansionPlanner', defaultExpansionPlannerMemory);
	const colonies = _.values(Overmind.colonies);
	if (!memory.startingRoomName && colonies.length == 1) {
		const startingColony = colonies[0];
		memory.startingRoomName = startingColony.room.name;
		if (startingColony.controller.safeMode) {
			memory.firstSafeModeEndsAt = Game.time + startingColony.controller.safeMode;
		} else {
			memory.firstSafeModeEnded = true;
		}
	}

	if (!memory.startingRoomName || memory.firstSafeModeEnded) {
		return false;
	}
	if (memory.firstSafeModeEndsAt && Game.time >= memory.firstSafeModeEndsAt) {
		memory.firstSafeModeEnded = true;
		return false;
	}
	return !!memory.firstSafeModeEndsAt;
}
