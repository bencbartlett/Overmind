import {Colony} from '../Colony';
import {Cartographer, ROOMTYPE_ALLEY, ROOMTYPE_CONTROLLER, ROOMTYPE_SOURCEKEEPER} from '../utilities/Cartographer';
import {BasePlanner} from '../roomPlanner/BasePlanner';
import {log} from '../console/log';
import {Pathing} from '../movement/Pathing';
import {derefCoords} from '../utilities/utils';


export class ExpansionPlanner {

	private evaluateExpansions(colony: Colony): void {
		if (_.keys(colony.memory.expansionData.possibleExpansions).length == 0
			|| Game.time > colony.memory.expansionData.expiration) {
			// Generate a list of rooms which can possibly be settled in
			let nearbyRooms = Cartographer.recursiveRoomSearch(colony.room.name, 5);
			let possibleExpansions: string[] = [];
			for (let depth in nearbyRooms) {
				if (parseInt(depth) <= 2) continue;
				possibleExpansions = possibleExpansions.concat(nearbyRooms[depth]);
			}
			for (let roomName of possibleExpansions) {
				if (Cartographer.roomType(roomName) == ROOMTYPE_CONTROLLER) {
					colony.memory.expansionData.possibleExpansions[roomName] = true;
				}
			}
		}
		for (let roomName in colony.memory.expansionData.possibleExpansions) {
			if (colony.memory.expansionData.possibleExpansions[roomName] == true) {
				if (Memory.rooms[roomName]) {
					let expansionData = Memory.rooms[roomName].expansionData;
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
	static computeExpansionData(room: Room, verbose = true): boolean {
		if (verbose) log.info(`Computing score for ${room.print}...`);
		if (!room.controller) {
			room.memory.expansionData = false;
			return false;
		}

		// compute possible outposts
		let possibleOutposts = _.flatten(_.values(Cartographer.recursiveRoomSearch(room.name, 2))) as string[];

		// find source positions
		let sourcePositions: { [roomName: string]: RoomPosition[] } = {};
		for (let roomName of possibleOutposts) {
			if (Cartographer.roomType(roomName) == ROOMTYPE_ALLEY) continue;
			let roomMemory = Memory.rooms[roomName];
			if (!roomMemory || !roomMemory.src) {
				if (verbose) log.info(`No memory of neighbor: ${roomName}. Aborting score calculation!`);
				return false;
			}
			sourcePositions[roomName] = _.map(roomMemory.src, obj => derefCoords(obj.c, roomName));
		}

		// compute a possible bunker position
		let bunkerLocation = BasePlanner.getBunkerLocation(room, false);
		if (!bunkerLocation) {
			room.memory.expansionData = false;
			log.info(`Room ${room.name} is uninhabitable because a bunker can't be built here!`);
			return false;
		}

		// evaluate energy contribution and compute outpost scores
		if (verbose) log.info(`Origin: ${bunkerLocation.print}`);

		let outpostScores: { [roomName: string]: number } = {};

		for (let roomName in sourcePositions) {
			if (verbose) log.info(`Analyzing neighbor ${roomName}`);
			let positions = sourcePositions[roomName];
			let valid = true;
			let roomType = Cartographer.roomType(roomName);
			let energyPerSource: number = SOURCE_ENERGY_CAPACITY;
			if (roomType == ROOMTYPE_SOURCEKEEPER) {
				continue; // TODO: add SK harvesting
				// energyPerSource = SOURCE_ENERGY_KEEPER_CAPACITY;
			}

			let roomScore = 0;
			for (let position of positions) {
				let msg = verbose ? `Computing distance from ${bunkerLocation.print} to ${position.print}... ` : '';
				let ret = Pathing.findShortestPath(bunkerLocation, position,
												   {ignoreStructures: true, allowHostile: true});
				if (ret.incomplete || ret.path.length > 150) {
					if (verbose) log.info(msg + 'incomplete path!');
					valid = false;
					break;
				}
				if (verbose) log.info(msg + ret.path.length);
				roomScore += energyPerSource / ret.path.length;
			}
			if (valid) {
				outpostScores[roomName] = roomScore;
			}
		}

		// Compute the total score of the room as the maximum energy score of max number of sources harvestable
		let totalScore = 0;
		let sourceCount = 0;
		let roomsByScore = _.sortBy(_.keys(outpostScores), roomName => -1 * outpostScores[roomName]);
		for (let roomName of roomsByScore) {
			if (sourceCount > Colony.settings.maxSourcesPerColony) break;
			totalScore += outpostScores[roomName];
			sourceCount += sourcePositions[roomName].length;
		}
		totalScore = Math.floor(totalScore);

		if (verbose) log.info(`Score: ${totalScore}`);

		if (!room.memory.expansionData || totalScore > room.memory.expansionData.score) {
			room.memory.expansionData = {
				score       : totalScore,
				bunkerAnchor: bunkerLocation.coordName,
				outposts    : outpostScores,
			};
		}
		return true;
	}

}


