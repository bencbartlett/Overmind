import {hasPos} from '../declarations/typeGuards';

/**
 * Returns destination.pos if destination has a position, or destination if destination is a RoomPosition
 */
export function normalizePos(destination: HasPos | RoomPosition): RoomPosition {
	if (hasPos(destination)) {
		return destination.pos;
	} else {
		return destination;
	}
}

/**
 * Returns if the coordinate is on an exit tile
 */
export function isExit(pos: Coord): boolean {
	return pos.x == 0 || pos.y == 0 || pos.x == 49 || pos.y == 49;
}

/**
 * Checks if the coordinates of two room positions are the same
 */
export function sameCoord(pos1: Coord, pos2: Coord): boolean {
	return pos1.x == pos2.x && pos1.y == pos2.y;
}

/**
 * Returns the number of move parts and number of weight-generating parts in a creep
 */
export function getCreepWeightInfo(creep: Creep, analyzeCarry = true): { move: number, weighted: number } {
	// Compute number of weighted and unweighted bodyparts
	const unweightedParts = analyzeCarry ? [MOVE, CARRY] : [MOVE];
	const bodyParts = _.countBy(creep.body, p => _.contains(unweightedParts, p.type) ? p.type : 'weighted');
	bodyParts.move = bodyParts.move || 0;
	bodyParts.weighted = bodyParts.weighted || 0;
	if (bodyParts[CARRY]) {
		bodyParts.weighted += Math.ceil(_.sum(creep.carry) / CARRY_CAPACITY);
	}
	// Account for boosts
	for (const part of creep.body) {
		if (part.type == MOVE && part.boost) {
			bodyParts.move += (BOOSTS.move[<'ZO' | 'ZHO2' | 'XZHO2'>part.boost].fatigue - 1);
		}
	}
	return bodyParts as { move: number, weighted: number, [other: string]: number };
}

/**
 * Get terrain costs which take into account a creep's individual fatigue stats
 */
export function getTerrainCosts(creep: Creep): { plainCost: number, swampCost: number } {
	const data = getCreepWeightInfo(creep);
	const ratio = data.weighted / data.move;
	return {
		plainCost: Math.ceil(ratio),
		swampCost: 5 * Math.ceil(ratio),
	};
}

