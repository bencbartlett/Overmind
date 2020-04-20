import {log} from '../console/log';
import {RoomIntel} from '../intel/RoomIntel';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {BasePlanner} from '../roomPlanner/BasePlanner';
import {
	Cartographer,
	ROOMTYPE_ALLEY,
	ROOMTYPE_CONTROLLER,
	ROOMTYPE_CORE,
	ROOMTYPE_CROSSROAD,
	ROOMTYPE_SOURCEKEEPER
} from '../utilities/Cartographer';

export const EXPANSION_EVALUATION_FREQ = 500;
export const MIN_EXPANSION_DISTANCE = 2;

export interface ColonyExpansionData {
	possibleExpansions: { [roomName: string]: number | boolean };
	expiration: number;
}


@profile
export class ExpansionEvaluator {


	static refreshExpansionData(expansionData: ColonyExpansionData, colonyRoomName: string): void {
		// This method is typed a little strangely to avoid some circular dependency problems

		// This only gets run once per colony
		if (_.keys(expansionData.possibleExpansions).length == 0 || Game.time > expansionData.expiration) {
			// Generate a list of rooms which can possibly be settled in
			const nearbyRooms = Cartographer.recursiveRoomSearch(colonyRoomName, 5);
			let possibleExpansions: string[] = [];
			for (const depth in nearbyRooms) {
				if (parseInt(depth, 10) <= MIN_EXPANSION_DISTANCE) continue;
				possibleExpansions = possibleExpansions.concat(nearbyRooms[depth]);
			}
			for (const roomName of possibleExpansions) {
				if (Cartographer.roomType(roomName) == ROOMTYPE_CONTROLLER) {
					expansionData.possibleExpansions[roomName] = true;
				}
			}
		}
		// This gets run whenever function is called
		for (const roomName in expansionData.possibleExpansions) {
			if (expansionData.possibleExpansions[roomName] == true) {
				if (Memory.rooms[roomName]) {
					const roomExpansionData = RoomIntel.getExpansionData(roomName);
					if (roomExpansionData == false) {
						expansionData.possibleExpansions[roomName] = false;
					} else if (roomExpansionData && roomExpansionData.score) {
						expansionData.possibleExpansions[roomName] = roomExpansionData.score;
					}
				}
			}
		}
	}

	// Compute the total score for a room
	static computeExpansionData(room: Room, verbose = false): boolean {
		if (verbose) log.info(`Computing score for ${room.print}...`);
		if (!room.controller) {
			RoomIntel.setExpansionData(room.name, false);
			return false;
		}

		// compute possible outposts (includes host room)
		const possibleOutposts = Cartographer.findRoomsInRange(room.name, 2);

		// find source positions
		const outpostSourcePositions: { [roomName: string]: RoomPosition[] } = {};
		for (const roomName of possibleOutposts) {
			if (Cartographer.roomType(roomName) == ROOMTYPE_ALLEY
				|| Cartographer.roomType(roomName) == ROOMTYPE_CROSSROAD) {
				continue;
			}
			const sourcePositions = RoomIntel.getSourceInfo(roomName);
			if (sourcePositions == undefined) {
				if (verbose) log.info(`No memory of neighbor: ${roomName}. Aborting score calculation!`);
				return false;
			} else {
				outpostSourcePositions[roomName] = _.map(sourcePositions, src => src.pos);
			}
		}

		// compute a possible bunker position
		const bunkerLocation = BasePlanner.getBunkerLocation(room, false);
		if (!bunkerLocation) {
			RoomIntel.setExpansionData(room.name, false);
			log.info(`Room ${room.name} is uninhabitable because a bunker can't be built here!`);
			return false;
		}

		// evaluate energy contribution and compute outpost scores
		if (verbose) log.info(`Origin: ${bunkerLocation.print}`);

		const outpostScores: { [roomName: string]: number } = {};

		for (const roomName in outpostSourcePositions) {
			if (verbose) log.info(`Analyzing neighbor ${roomName}`);
			const sourcePositions = outpostSourcePositions[roomName];
			let valid = true;
			const roomType = Cartographer.roomType(roomName);
			let energyPerSource: number = SOURCE_ENERGY_CAPACITY;
			if (roomType == ROOMTYPE_SOURCEKEEPER) {
				energyPerSource = 0.6 * SOURCE_ENERGY_KEEPER_CAPACITY; // don't favor SK rooms too heavily -- more CPU
			} else if (roomType == ROOMTYPE_CORE) {
				energyPerSource = SOURCE_ENERGY_KEEPER_CAPACITY;
			}

			let roomScore = 0;
			for (const position of sourcePositions) {
				const msg = verbose ? `Computing distance from ${bunkerLocation.print} to ${position.print}... ` : '';
				const ret = Pathing.findShortestPath(bunkerLocation, position,
													 {ignoreStructures: true, allowHostile: true});
				if (ret.incomplete || ret.path.length > 100 /* Colony.settings.maxSourceDistance */) {
					if (verbose) log.info(msg + 'incomplete path!');
					valid = false;
					break;
				}
				if (verbose) log.info(msg + ret.path.length);
				const offset = 25; // prevents over-sensitivity to very close sources
				roomScore += energyPerSource / (ret.path.length + offset);
			}
			if (valid) {
				outpostScores[roomName] = Math.floor(roomScore);
			}
		}

		// Compute the total score of the room as the maximum energy score of max number of sources harvestable
		let totalScore = 0;
		let sourceCount = 0;
		const roomsByScore = _.sortBy(_.keys(outpostScores), roomName => -1 * outpostScores[roomName]);
		for (const roomName of roomsByScore) {
			if (sourceCount > 9 /*Colony.settings.remoteSourcesByLevel[8]*/) break;
			const factor = roomName == room.name ? 2 : 1; // weight owned room scores more heavily
			totalScore += outpostScores[roomName];
			sourceCount += outpostSourcePositions[roomName].length;
		}
		totalScore = Math.floor(totalScore);

		if (verbose) log.info(`Score: ${totalScore}`);

		const existingExpansionData = RoomIntel.getExpansionData(room.name);
		if (existingExpansionData === false) {
			log.error(`ExpansionEvaluator: shouldn't be here!`);
			return false;
		}

		if (existingExpansionData == undefined || totalScore > existingExpansionData.score) {
			RoomIntel.setExpansionData(room.name, {
				score       : totalScore,
				bunkerAnchor: bunkerLocation,
				outposts    : outpostScores,
			});
		}

		return true;
	}

}


