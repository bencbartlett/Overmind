// Sandbox code: lets you try out random stuff at the end of main loop

import {getFlagAllies, isAllyBySign} from './alliance';
import {log} from './console/log';
// import {tftest} from './reinforcementLearning/test'

// Observation-only ally detection — logs friend status and records it into
// Memory.stats.alliance for external polling (see phase-1_6 Task #10 /
// screeps-metrics's hermes digest jobs). No gameplay effect.
// See obsidian ADR 0006 for the staged rollout plan toward combat/targeting integration.
function logAllianceStatus() {
	const flagAllies = getFlagAllies();
	if (flagAllies.size > 0) {
		log.info(`[Alliance] Flag allies visible: ${Array.from(flagAllies).sort().join(', ')}`);
	}
	const signedRooms: { [roomName: string]: string } = {};
	for (const roomName in Game.rooms) {
		const signedBy = isAllyBySign(Game.rooms[roomName]);
		if (signedBy) {
			signedRooms[roomName] = signedBy;
			log.info(`[Alliance] ${roomName} controller signed by ally ${signedBy}`);
		}
	}
	Memory.stats.alliance = {
		flagAllies: Array.from(flagAllies).sort(),
		signedRooms: signedRooms,
	};
}

export function sandbox() {
	try {
		logAllianceStatus();
		// tftest();
	} catch (e) {
		log.error(e);
	}
}
