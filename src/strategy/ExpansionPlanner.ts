import {Colony} from '../Colony';
import {
	Cartographer,
	ROOMTYPE_ALLEY,
	ROOMTYPE_CONTROLLER,
	ROOMTYPE_CORE,
	ROOMTYPE_SOURCEKEEPER
} from '../utilities/Cartographer';
import {BasePlanner} from '../roomPlanner/BasePlanner';
import {log} from '../console/log';
import {Pathing} from '../movement/Pathing';
import {derefCoords} from '../utilities/utils';
import {profile} from '../profiler/decorator';

export const EXPANSION_EVALUATION_FREQ = 500;
export const MIN_EXPANSION_DISTANCE = 2;

@profile
export class ExpansionPlanner {

	static refreshExpansionData(colony: Colony): void {
		// This only gets run once per colony
		if (_.keys(colony.memory.expansionData.possibleExpansions).length == 0
			|| Game.time > colony.memory.expansionData.expiration) {
			// Generate a list of rooms which can possibly be settled in
			let nearbyRooms = Cartographer.recursiveRoomSearch(colony.room.name, 5);
			let possibleExpansions: string[] = [];
			for (let depth in nearbyRooms) {
				if (parseInt(depth) <= MIN_EXPANSION_DISTANCE) continue;
				possibleExpansions = possibleExpansions.concat(nearbyRooms[depth]);
			}
			for (let roomName of possibleExpansions) {
				if (Cartographer.roomType(roomName) == ROOMTYPE_CONTROLLER) {
					colony.memory.expansionData.possibleExpansions[roomName] = true;
				}
			}
		}
		// This gets run whenever function is called
		for (let roomName in colony.memory.expansionData.possibleExpansions) {
			if (colony.memory.expansionData.possibleExpansions[roomName] == true) {
				if (Memory.rooms[roomName]) {
					let expansionData = Memory.rooms[roomName][_RM.EXPANSION_DATA];
					if (expansionData == false) {
						colony.memory.expansionData.possibleExpansions[roomName] = false;
					} else if (expansionData && expansionData.score) {
						colony.memory.expansionData.possibleExpansions[roomName] = expansionData.score;
					}
				}
			}
		}
	}

	// Compute the total score for a room
	static computeExpansionData(room: Room, verbose = false): boolean {
		if (verbose) log.info(`Computing score for ${room.print}...`);
		if (!room.controller) {
			room.memory[_RM.EXPANSION_DATA] = false;
			return false;
		}

		// compute possible outposts (includes host room)
		let possibleOutposts = Cartographer.findRoomsInRange(room.name, 2);

		// find source positions
		let outpostSourcePositions: { [roomName: string]: RoomPosition[] } = {};
		for (let roomName of possibleOutposts) {
			if (Cartographer.roomType(roomName) == ROOMTYPE_ALLEY) continue;
			let roomMemory = Memory.rooms[roomName];
			if (!roomMemory || !roomMemory[_RM.SOURCES]) {
				if (verbose) log.info(`No memory of neighbor: ${roomName}. Aborting score calculation!`);
				return false;
			}
			outpostSourcePositions[roomName] = _.map(roomMemory[_RM.SOURCES]!, obj => derefCoords(obj.c, roomName));
		}

		// compute a possible bunker position
		let bunkerLocation = BasePlanner.getBunkerLocation(room, false);
		if (!bunkerLocation) {
			room.memory[_RM.EXPANSION_DATA] = false;
			log.info(`Room ${room.name} is uninhabitable because a bunker can't be built here!`);
			return false;
		}

		// evaluate energy contribution and compute outpost scores
		if (verbose) log.info(`Origin: ${bunkerLocation.print}`);

		let outpostScores: { [roomName: string]: number } = {};

		for (let roomName in outpostSourcePositions) {
			if (verbose) log.info(`Analyzing neighbor ${roomName}`);
			let sourcePositions = outpostSourcePositions[roomName];
			let valid = true;
			let roomType = Cartographer.roomType(roomName);
			let energyPerSource: number = SOURCE_ENERGY_CAPACITY;
			if (roomType == ROOMTYPE_SOURCEKEEPER) {
				energyPerSource = 0.6 * SOURCE_ENERGY_KEEPER_CAPACITY; // don't favor SK rooms too heavily -- more CPU
			} else if (roomType == ROOMTYPE_CORE) {
				energyPerSource = SOURCE_ENERGY_KEEPER_CAPACITY;
			}

			let roomScore = 0;
			for (let position of sourcePositions) {
				let msg = verbose ? `Computing distance from ${bunkerLocation.print} to ${position.print}... ` : '';
				let ret = Pathing.findShortestPath(bunkerLocation, position,
												   {ignoreStructures: true, allowHostile: true});
				if (ret.incomplete || ret.path.length > Colony.settings.maxSourceDistance) {
					if (verbose) log.info(msg + 'incomplete path!');
					valid = false;
					break;
				}
				if (verbose) log.info(msg + ret.path.length);
				let offset = 25; // prevents over-sensitivity to very close sources
				roomScore += energyPerSource / (ret.path.length + offset);
			}
			if (valid) {
				outpostScores[roomName] = Math.floor(roomScore);
			}
		}

		// Compute the total score of the room as the maximum energy score of max number of sources harvestable
		let totalScore = 0;
		let sourceCount = 0;
		let roomsByScore = _.sortBy(_.keys(outpostScores), roomName => -1 * outpostScores[roomName]);
		for (let roomName of roomsByScore) {
			if (sourceCount > Colony.settings.remoteSourcesByLevel[8]) break;
			let factor = roomName == room.name ? 2 : 1; // weight owned room scores more heavily
			totalScore += outpostScores[roomName];
			sourceCount += outpostSourcePositions[roomName].length;
		}
		totalScore = Math.floor(totalScore);

		if (verbose) log.info(`Score: ${totalScore}`);

		if (!room.memory[_RM.EXPANSION_DATA] ||
			totalScore > (<ExpansionData>room.memory[_RM.EXPANSION_DATA]).score) {
			room.memory[_RM.EXPANSION_DATA] = {
				score       : totalScore,
				bunkerAnchor: bunkerLocation.coordName,
				outposts    : outpostScores,
			};
		}

		return true;
	}

}


