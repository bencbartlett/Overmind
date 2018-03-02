// Sandbox code: lets you try out random stuff at the end of main loop

import {log} from './lib/logger/log';

export function sandbox() {
	try { // Test code goes here

	} catch (e) {
		log.error(e);
	}
}