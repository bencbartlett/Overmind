/* Way to test code and catch exceptions at the end of main loop */

import {log} from '../lib/logger/log';

// const columnify = require('../lib/columnify/index')

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
		// var data = {
		// 	"commander@0.6.1": 1,
		// 	"minimatch@0.2.14": 3,
		// 	"mkdirp@0.3.5": 2,
		// 	"sigmund@1.0.0": 3
		// };
		//
		// console.log(columnify(data))
	} catch (e) {
		log.error(e);
	}
}