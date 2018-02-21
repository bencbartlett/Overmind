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
		// let asdf = Traveler.findTravelPath(Overmind.Colonies.E5S47.pos, deref('Flag17:E5S47:healPoint')!.pos,
		// 								   {
		// 									   ignoreCreeps: true,
		// 									   range       : 1,
		// 									   offRoad     : true,
		// 									   allowSK     : true,
		// 									   ensurePath: true,
		// 								   });
		// console.log(asdf.path.length)
		// console.log(asdf.incomplete)
	} catch (e) {
		log.error(e);
	}
}