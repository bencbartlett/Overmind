// Sandbox code: lets you try out random stuff at the end of main loop

import {log} from './console/log';

export function sandbox() {
	try {
		// testDistanceTransform('W8N3')
		// determineBunkerLocation('W8N3')
	} catch (e) {
		log.error(e);
	}
}