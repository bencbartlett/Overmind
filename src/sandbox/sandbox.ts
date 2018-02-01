/* Way to test code and catch exceptions at the end of main loop */

import {log} from '../lib/logger/log';
import {Colony} from '../Colony';

export class TestCache {
	times: number[];

	constructor() {
		this.times = [];
	}

	update() {
		this.times.push(Game.time);
	}
}


// export function testVisualizer() {
//
// }
//
// export function testGraph() {
// 	let G = new Graph();
// 	for (let i = 0; i <= 10; i++) {
// 		G.addVertex(new Vertex());
// 	}
// 	for (let v1 of G.vertices) {
// 		for (let v2 of G.vertices) {
// 			if (v1 != v2 && !v1.adjacentTo(v2)) {
// 				G.connect(v1, v2);
// 			}
// 		}
// 	}
// 	for (let v of G.vertices) {
// 		console.log(v.id, 'neighbors: ', _.map(v.neighbors, neighbor => neighbor.id));
// 	}
// }

export function testRoomPlanner() {
	let colonyName = 'W8N3';
	let colony: Colony = Overmind.Colonies[colonyName];
	let planner = colony.roomPlanner;
	// planner.active = true;
	// Visualizer.drawLayout(planner.map, colonyName);

	// for (let source of colony.sources) {
	// 	planner.planRoad(colony.storage!.pos, source.pos);
	// }
}

export function sandbox() {
	try { // Test code goes here
		// testRoomPlanner();
		// let start = Game.cpu.getUsed();
		// for (let i = 0; i < 10000; i++) {
		// 	let vis = Game.rooms.W8N3.visual;
		// }
		// let mid = Game.cpu.getUsed();
		// for (let i = 0; i < 10000; i++) {
		// 	let vis = new RoomVisual('W8N3');
		// }
		// let stop = Game.cpu.getUsed();
		// console.log(`1: ${mid - start}`);
		// console.log(`2: ${stop - mid}`);
	} catch (e) {
		log.error(e);
	}
}