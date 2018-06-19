import {hasPos} from '../declarations/typeGuards';

/* Returns destination.pos if destination has a position, or destination if destination is a RoomPosition */
export function normalizePos(destination: HasPos | RoomPosition): RoomPosition {
	if (hasPos(destination)) {
		return destination.pos;
	} else {
		return destination;
	}
}

/* Returns if the coordinate is on an exit tile */
export function isExit(pos: Coord): boolean {
	return pos.x == 0 || pos.y == 0 || pos.x == 49 || pos.y == 49;
}

/* Checks if the coordinates of two room positions are the same */
export function sameCoord(pos1: Coord, pos2: Coord): boolean {
	return pos1.x == pos2.x && pos1.y == pos2.y;
}

/* Returns the number of move parts and number of weight-generating parts in a creep */
export function getCreepWeightInfo(creep: Creep, analyzeCarry = true): { move: number, weighted: number } {
	// Compute number of weighted and unweighted bodyparts
	const unweightedParts = analyzeCarry ? [MOVE, CARRY] : [MOVE];
	const bodyParts = _.countBy(creep.body, p => _.contains(unweightedParts, p.type) ? p.type : 'weighted');
	bodyParts.move = bodyParts.move || 0;
	bodyParts.weighted = bodyParts.weighted || 0;
	if (bodyParts[CARRY]) {
		bodyParts.weighted = Math.ceil(_.sum(creep.carry) / CARRY_CAPACITY) + bodyParts.weighted;
	}
	// Account for boosts
	for (let part of creep.body) {
		if (part.type == MOVE && part.boost) {
			bodyParts.move += (BOOSTS.move[<'ZO' | 'ZHO2' | 'XZHO2'>part.boost].fatigue - 1);
		}
	}
	return bodyParts as { move: number, weighted: number, [other: string]: number };
}

export function getTerrainCosts(creep: Creep): { plains: number, swamp: number } {
	const data = getCreepWeightInfo(creep);
	const ratio = data.weighted / data.move;
	return {
		plains: ratio <= 1 ? 1 : 2,
		swamp : getSwampCost(ratio),
	};
}

function getSwampCost(ratio: number): number {
	const clamped = ratio < 0.2 ? 0.2 : ratio > 1 ? 1 : ratio;
	return Math.ceil(clamped * 5);
}
