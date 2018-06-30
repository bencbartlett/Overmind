import {distanceTransform} from './algorithms/distanceTransform';
import {allBunkerCoords, bunkerLayout} from './roomPlanner/layouts/bunker';

export function determineBunkerLocation(roomName: string): void {
	let dt = distanceTransform(roomName);
	let coords: Coord[] = [];
	let x, y, value: number;
	for (y = 0 + 8; y < 50 - 8; ++y) {
		for (x = 0 + 8; x < 50 - 8; ++x) {
			if (dt.get(x, y) >= 7) {
				coords.push({x, y});
			} else if (dt.get(x, y) >= 5 && !intersectsWithBunker({x, y}, dt)) {
				coords.push({x, y});
			}
		}
	}
	let vis = new RoomVisual();
	for (let coord of coords) {
		vis.text(dt.get(coord.x, coord.y).toString(), coord.x, coord.y);
	}
}

export function intersectsWithBunker(anchor: Coord, distanceMatrix: CostMatrix): boolean {
	let dx = anchor.x - bunkerLayout.data.anchor.x;
	let dy = anchor.y - bunkerLayout.data.anchor.y;
	let bunkerCoordsAtAnchor = _.map(allBunkerCoords[8], function (coord) {
		return {x: coord.x + dx, y: coord.y + dy};
	});
	return _.any(bunkerCoordsAtAnchor, coord => distanceMatrix.get(coord.x, coord.y) == 0);
}