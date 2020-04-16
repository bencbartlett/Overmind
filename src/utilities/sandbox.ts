// Sandbox code: lets you try out random stuff at the end of main loop

import {testEncoder} from '../algorithms/utf15';
import {log} from '../console/log';
import {testIdEncoder} from './packrat';

// import {tftest} from './reinforcementLearning/test'

export function sandbox() {
	try {
		global.testEncoder = testEncoder;
		global.testMyEncoder = testIdEncoder;
	} catch (e) {
		log.error(e);
	}
}
