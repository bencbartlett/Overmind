// Sandbox code: lets you try out random stuff at the end of main loop

import {log} from './console/log';
// import {tftest} from './reinforcementLearning/test'

export function sandbox() {
	try {
		// tftest();
	} catch (e) {
		log.error(e);
	}
}
