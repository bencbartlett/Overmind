/* Way to test code and catch exceptions at the end of main loop */

import {Visualizer} from '../visuals/Visualizer';
import {RoomPlanner} from '../roomPlanner/RoomPlanner';
import {Pathing} from '../pathing/pathing';
import {log} from '../lib/logger/log';
import {Graph, Vertex} from '../dataStructures/Graph';

export class TestCache {
	times: number[];

	constructor() {
		this.times = [];
	}

	update() {
		this.times.push(Game.time);
	}
}

export class TestRef {
	thing: number;

	constructor(thing: any) {
		this.thing = thing.times;
	}
}

let colonyName = 'W19N86';

export function testVisualizer() {
	// let level = 1 + Game.time % 8;
	// Visualizer.drawLayout(hatcheryLayout, {x: 15, y: 30}, level);
	// Visualizer.drawLayout(commandCenterLayout, {x: 30, y: 30}, level);

	let planner = new RoomPlanner(colonyName);
	Visualizer.drawLayout(planner.map, colonyName);

	let path = Pathing.findShortestPath(deref('58f3c9cc2451c2bb06d9c64c')!.pos, deref('5873bcd711e3e4361b4d8452')!.pos);
	Visualizer.drawRoad(path!);
}

export function testGraph() {
	let G = new Graph();
	for (let i = 0; i <= 10; i++) {
		G.addVertex(new Vertex());
	}
	for (let v1 of G.vertices) {
		for (let v2 of G.vertices) {
			if (v1 != v2 && !v1.adjacentTo(v2)) {
				G.connect(v1, v2);
			}
		}
	}
	for (let v of G.vertices) {
		console.log(v.id, 'neighbors: ', _.map(v.neighbors, neighbor => neighbor.id));
	}
}

export function testRoomPlanner() {

	let colony = Overmind.Colonies[colonyName];
	let planner = new RoomPlanner(colonyName);
	Visualizer.drawLayout(planner.map, colonyName);

	for (let source of colony.sources) {
		planner.planRoad(colony.storage!.pos, source.pos);
	}
}

export function sandbox() {
	try {
		// Test code goes here
		// testGraph();
		// testVisualizer()
		// testRoomPlanner();
	} catch (e) {
		log.error(e);
	}
}