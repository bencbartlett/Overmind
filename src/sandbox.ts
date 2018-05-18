// Sandbox code: lets you try out random stuff at the end of main loop

import {log} from './lib/logger/log';
import {testMinCut} from './algorithms/minCut';

global.testMinCut = testMinCut;

export function sandbox() {
	try {
		if (global.testRoom) {
			if (Game.time % 2 == 0) {
				testMinCut(global.testRoom, true);
			} else {
				testMinCut(global.testRoom, false);
			}
		}
	} catch (e) {
		log.error(e);
	}
}