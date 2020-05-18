import {log} from '../console/log';
import {bodyCost} from '../creepSetups/CreepSetup';
import {CombatSetups, Setups} from '../creepSetups/setups';
import {RoomIntel, SourceInfo} from '../intel/RoomIntel';
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
import set = Reflect.set;

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


	/**
	 * Returns the net energy income per cpu spent
	 * @param dropoffLocation point of origin
	 * @param room
	 * @param verbose
	 */
	static computeTheoreticalMiningEfficiency(dropoffLocation: RoomPosition, room: string, verbose = false)
		: boolean|number {
		const roomName = room;
		const roomType = Cartographer.roomType(roomName);
		let cpuCost = 0;
		let creepEnergyCost = 0;
		let spawnTimeCost = 0;
		const upkeepEnergyCost = 0; // todo later can factor in road damage from all creeps moving

		const sourcePositions = RoomIntel.getSourceInfo(roomName);
		if (sourcePositions == undefined) {
			if (verbose) log.info(`No memory of outpost room: ${roomName}. Aborting score calculation!`);
			return false;
		}
		// Compute Path length
		// TODO have it track how many swamp/plain/tunnel
		const sourcePathLengths: {[sourcePos: string]: number} = {};
		for (const source of sourcePositions) {
			if (!source.containerPos) {
				log.info(`Can't find container position for source ${source} during efficiency calc`);
				return false;
			}
			// TODO Need to factor in where roads would go
			const path = Pathing.findShortestPath(dropoffLocation, source.containerPos,
				{ignoreStructures: true, allowHostile: true});

			if (path.incomplete) {
				log.error(`Couldn't find path to source ${source} for mining efficiency calc`);
				return false;
			}

			sourcePathLengths[source.pos.print] = path.path.length;
		}

		// Compute Energy Supply
		const energyPerSource = roomType == ROOMTYPE_CONTROLLER ? SOURCE_ENERGY_CAPACITY : SOURCE_ENERGY_KEEPER_CAPACITY;

		// Compute miner upkeep
		for (const source of sourcePositions) {
			const setup = roomType == ROOMTYPE_CONTROLLER ? Setups.drones.miners.standard.generateMaxedBody()
				: Setups.drones.miners.sourceKeeper.generateMaxedBody();
			const effectiveCreepUptime = (CREEP_LIFE_TIME - sourcePathLengths[source.pos.print]);
			creepEnergyCost += bodyCost(setup)/effectiveCreepUptime;
			spawnTimeCost += setup.length*CREEP_SPAWN_TIME/effectiveCreepUptime;
			// Always harvesting, sometimes replacement is moving
			cpuCost += 0.2 + 0.2*(1-effectiveCreepUptime/CREEP_LIFE_TIME);
		}

		// Compute reserver/skReaper upkeep
		if (roomType == ROOMTYPE_CONTROLLER) {
			const controller = RoomIntel.getControllerInfo(roomName);
			if (!controller) {
				log.error(`Expansion Efficiency Calc: Can't find controller for room ${roomName}`);
				return false;
			} else {
				const setup = Setups.infestors.reserve.generateMaxedBody();
				const controllerPath = Pathing.findShortestPath(dropoffLocation, controller.pos,
					{ignoreStructures: true, allowHostile: true});
				if (controllerPath.incomplete) {
					log.error(`Couldn't find path to controller ${controller} for mining efficiency calc`);
					return false;
				}
				const claimPower = _.filter(setup, (part: BodyPartConstant) => part == CLAIM).length;
				const effectiveLifetimeReservationGeneration = (CREEP_CLAIM_LIFE_TIME - controllerPath.path.length) * claimPower;
				creepEnergyCost += bodyCost(setup)/effectiveLifetimeReservationGeneration;
				spawnTimeCost += setup.length*CREEP_SPAWN_TIME/effectiveLifetimeReservationGeneration;
				cpuCost += 0.2 * CREEP_CLAIM_LIFE_TIME / effectiveLifetimeReservationGeneration;
			}
		} else if (roomType == ROOMTYPE_SOURCEKEEPER) {
			// Handle SK
			const setup = CombatSetups.zerglings.sourceKeeper.generateMaxedBody();
			const skPath = Pathing.findPathToRoom(dropoffLocation, roomName,
				{ignoreStructures: true, allowHostile: true});
			if (skPath.incomplete) {
				log.error(`Couldn't find path to sk room ${roomName} for mining efficiency calc`);
				return false;
			}
			const effectiveCreepUptime = (CREEP_LIFE_TIME - skPath.path.length);
			creepEnergyCost += bodyCost(setup)/effectiveCreepUptime;
			spawnTimeCost += setup.length*CREEP_SPAWN_TIME/effectiveCreepUptime;
			//  Increased cost, always moving, frequent attack/move+heal intents, and during overlap 2nd creep moving to room
			cpuCost += 0.2 + 0.15 + 0.2*(1-effectiveCreepUptime/CREEP_LIFE_TIME);
			// TODO examine for accuracy Increased cost, frequent attack/move+heal intents
		}

		// Compute transporter upkeep
		for (const source of sourcePositions) {
			const setup = Setups.transporters.default.generateMaxedBody();
			// Calculate amount of hauling each transporter provides in a lifetime
			const transporterCarryParts = _.filter(setup, (part: BodyPartConstant) => part == CARRY).length;
			const effectiveEnergyTransportedPerTick = transporterCarryParts * CARRY_CAPACITY
				/ (2 * sourcePathLengths[source.pos.print]); // round trip
			const transportersPerSource = energyPerSource/ENERGY_REGEN_TIME/effectiveEnergyTransportedPerTick;

			creepEnergyCost += bodyCost(setup)*transportersPerSource/CREEP_LIFE_TIME;
			spawnTimeCost += setup.length*CREEP_SPAWN_TIME*transportersPerSource/CREEP_LIFE_TIME;
			cpuCost += 0.2 * transportersPerSource;
		}

		const netIncome = (energyPerSource*sourcePositions.length/ENERGY_REGEN_TIME)-creepEnergyCost;

		let msg = `(Potential) Outpost ${room} type ${roomType} evaluated for colony at ${dropoffLocation.roomName} with per tick results \n`;
		msg += `Income: ${energyPerSource*sourcePositions.length/ENERGY_REGEN_TIME} Net Income: ${netIncome} Net Energy per CPU: ${netIncome/cpuCost}\n`;
		msg += `Creep Costs: Energy ${creepEnergyCost}, Spawn Time ${spawnTimeCost}, and CPU ${cpuCost} \n`;
		log.alert(msg);
		return netIncome/cpuCost;
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


