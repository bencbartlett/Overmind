import {distanceTransform} from '../algorithms/distanceTransform';
import {allBunkerCoords, BUNKER_RADIUS, bunkerCoordLookup, bunkerLayout} from './layouts/bunker';
import {coordName, minBy} from '../utilities/utils';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';

const MAX_SAMPLE = 10;
const MAX_TOTAL_PATH_LENGTH = 25 * 3;

@profile
export class BasePlanner {

	static getBunkerLocation(room: Room, visualize = true): RoomPosition | undefined {
		let colony = Overmind.colonies[room.name] as Colony;
		if (colony && colony.bunker && colony.bunker.anchor) {
			return colony.bunker.anchor;
		}
		let allowableLocations = this.getAllowableBunkerLocations(room, visualize);
		if (allowableLocations.length > MAX_SAMPLE) {
			allowableLocations = _.sample(allowableLocations, MAX_SAMPLE);
		}
		let minimizePathLengthTo: RoomPosition[] = _.map(_.compact([...room.sources, room.controller]),
														 obj => obj!.pos);
		let totalPathLength = function (anchor: RoomPosition) {
			let totalDistance = 0;
			for (let pos of minimizePathLengthTo) {
				let ret = Pathing.findShortestPath(anchor, pos, {ignoreStructures: true});
				if (!ret.incomplete) {
					totalDistance += ret.path.length;
				} else {
					totalDistance += Infinity;
				}
			}
			return totalDistance;
		};
		let bestAnchor = minBy(allowableLocations, pos => totalPathLength(pos));
		if (bestAnchor && totalPathLength(bestAnchor) <= MAX_TOTAL_PATH_LENGTH) {
			return bestAnchor;
		}
	}

	private static getAllowableBunkerLocations(room: Room, visualize = true): RoomPosition[] {
		let allowableLocations = this.getNonIntersectingBunkerLocations(room.name, visualize);
		if (allowableLocations.length > MAX_SAMPLE) {
			allowableLocations = _.sample(allowableLocations, MAX_SAMPLE);
		}
		// Filter intersection with controller
		if (!room.controller) return [];
		allowableLocations = _.filter(allowableLocations,
									  anchor => !this.bunkerIntersectsWith(anchor, room.controller!.pos, 3));
		// Filter intersection with miningSites
		let sitesAndMineral: RoomPosition[] = _.map(_.compact([...room.sources, room.mineral]), obj => obj!.pos);
		allowableLocations = _.filter(allowableLocations,
									  anchor => !_.any(sitesAndMineral,
													   pos => this.bunkerIntersectsWith(anchor, pos, 1)));
		if (visualize) {
			let vis = room.visual;
			for (let pos of allowableLocations) {
				vis.circle(pos.x, pos.y, {fill: 'purple'});
			}
		}
		return allowableLocations;
	}

	private static getNonIntersectingBunkerLocations(roomName: string, visualize = true): RoomPosition[] {
		let dt = distanceTransform(roomName);
		let coords: Coord[] = [];
		let x, y, value: number;
		for (y of _.range(BUNKER_RADIUS + 2, 50 - (BUNKER_RADIUS + 2))) {
			for (x of _.range(BUNKER_RADIUS + 2, 50 - (BUNKER_RADIUS + 2))) {
				if (dt.get(x, y) >= BUNKER_RADIUS + 1) {
					// If it fits, I sits
					coords.push({x, y});
				} else if (dt.get(x, y) >= (BUNKER_RADIUS - 1) && !this.terrainIntersectsWithBunker({x, y}, dt)) {
					// If it might not fits, check that it fits before I sits
					coords.push({x, y});
				}
			}
		}
		if (visualize) {
			let vis = new RoomVisual(roomName);
			for (let coord of coords) {
				vis.text(dt.get(coord.x, coord.y).toString(), coord.x, coord.y);
			}
		}
		return _.map(coords, coord => new RoomPosition(coord.x, coord.y, roomName));
	}

	private static terrainIntersectsWithBunker(anchor: Coord, distanceMatrix: CostMatrix): boolean {
		let dx = anchor.x - bunkerLayout.data.anchor.x;
		let dy = anchor.y - bunkerLayout.data.anchor.y;
		let bunkerCoordsAtAnchor = _.map(allBunkerCoords[8], function (coord) {
			return {x: coord.x + dx, y: coord.y + dy};
		});
		return _.any(bunkerCoordsAtAnchor, coord => distanceMatrix.get(coord.x, coord.y) == 0);
	}

	private static bunkerIntersectsWith(anchor: Coord | RoomPosition, obstacle: Coord | RoomPosition,
										padding = 1): boolean {
		let dx = bunkerLayout.data.anchor.x - anchor.x;
		let dy = bunkerLayout.data.anchor.y - anchor.y;
		let x, y: number;
		for (x of _.range(obstacle.x + dx - padding, obstacle.x + dx + padding + 1)) {
			for (y of _.range(obstacle.y + dy - padding, obstacle.y + dy + padding + 1)) {
				if (bunkerCoordLookup[8][coordName({x, y})]) {
					return true;
				}
			}
		}
		return false;
	}

}
