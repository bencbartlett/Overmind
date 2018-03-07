// Sandbox code: lets you try out random stuff at the end of main loop

import {log} from './lib/logger/log';

export function sandbox() {
	try { // Test code goes here
		// let array = [{'n':1}, {'n':2}]
		// console.log(minBy(array, (thing: any)=>thing.n).n)
	} catch (e) {
		log.error(e);
	}
}