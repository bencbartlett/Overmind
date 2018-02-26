/* Way to test code and catch exceptions at the end of main loop */

import {log} from '../lib/logger/log';


export class TestCache {
	times: number[];

	constructor() {
		this.times = [];
	}

	update() {
		this.times.push(Game.time);
	}
}


export function sandbox() {
	try { // Test code goes here

	} catch (e) {
		log.error(e);
	}
}