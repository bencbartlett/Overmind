import {distanceTransform} from '../algorithms/distanceTransform';
import {allBunkerCoords, bunkerLayout} from './layouts/bunker';

export class BasePlanner {

	// static getBunkerLocation(roomName: string, visualize = true): RoomPosition | undefined {
	// 	let possibleLocations = this.getPossibleBunkerLocations(roomName, visualize);
	// 	// let obstacles =
	// }

	static getPossibleBunkerLocations(roomName: string, visualize = true): RoomPosition[] {
		let dt = distanceTransform(roomName);
		let coords: Coord[] = [];
		let x, y, value: number;
		for (y = 0 + 8; y < 50 - 8; ++y) {
			for (x = 0 + 8; x < 50 - 8; ++x) {
				if (dt.get(x, y) >= 7) {
					coords.push({x, y});
				} else if (dt.get(x, y) >= 5 && !this.terrainIntersectsWithBunker({x, y}, dt)) {
					coords.push({x, y});
				}
			}
		}
		if (visualize) {
			let vis = new RoomVisual();
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

	// private static bunkerIntersectionFilter(anchor: Coord | RoomPosition, obstacles: (Coord | RoomPosition)[],
	// 										padding = 1): boolean {
	//
	// }

}
