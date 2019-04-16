import { Colony, getAllColonies } from '../Colony';
import { assimilationLocked } from '../assimilation/decorator';
import { log } from '../console/log';
import { DirectiveColonize } from '../directives/colony/colonize';
import { Autonomy, Mem, getAutonomyLevel } from '../memory/Memory';
import { Pathing } from '../movement/Pathing';
import { profile } from '../profiler/decorator';
import { Cartographer } from '../utilities/Cartographer';
import { maxBy } from '../utilities/utils';
import { MAX_OWNED_ROOMS, MY_USERNAME, SHARD3_MAX_OWNED_ROOMS } from '../~settings';
import { MIN_EXPANSION_DISTANCE } from './ExpansionPlanner';


const CHECK_EXPANSION_FREQUENCY = 1000;

const UNOWNED_MINERAL_BONUS = 100;
const CATALYST_BONUS = 75;
const MAX_SCORE_BONUS = _.sum([UNOWNED_MINERAL_BONUS, CATALYST_BONUS]);

const TOO_CLOSE_PENALTY = 100;

interface StrategistMemory {

}

const defaultStrategistMemory: StrategistMemory = {};

/**
 * The Strategist makes high-level game decisions such as choosing when/where to expand and who to harass. It is located
 * on Overmind.strategist and is only instantiated if the AI is run in full-auto mode.
 */
@assimilationLocked
@profile
export class Strategist implements IStrategist {

	memory: StrategistMemory;

	constructor() {
		this.memory = Mem.wrap(Memory, 'strategist', defaultStrategistMemory);
	}

	refresh() {
		this.memory = Mem.wrap(Memory, 'strategist', defaultStrategistMemory);
	}

	private handleExpansion(): void {
		let allColonies = getAllColonies();
		// If you already have max number of colonies, ignore
		if (allColonies.length >= Math.min(Game.gcl.level, MAX_OWNED_ROOMS)) {
			return;
		}
		// If you are on shard3, limit to 3 owned rooms // TODO: use CPU-based limiting metric
		if (Game.shard.name == 'shard3') {
			if (allColonies.length >= SHARD3_MAX_OWNED_ROOMS) {
				return;
			}
		}

		let roomName = this.chooseNextColonyRoom();
		if (roomName) {
			let pos = Pathing.findPathablePosition(roomName);
			DirectiveColonize.createIfNotPresent(pos, 'room');
			log.notify(`Room ${roomName} selected as next colony! Creating colonization directive.`);
		}
	}

	private chooseNextColonyRoom(): string | undefined {
		// Generate a list of possible colonies to expand from based on level and whether they are already expanding
		// let possibleIncubators: Colony[] = []; // TODO: support incubation
		let possibleColonizers: Colony[] = [];
		for (let colony of getAllColonies()) {
			// if (colony.level >= DirectiveIncubate.requiredRCL
			// 	&& _.filter(colony.flags, flag => DirectiveIncubate.filter(flag)).length == 0) {
			// 	possibleIncubators.push(colony);
			// }
			if (colony.level >= DirectiveColonize.requiredRCL
				&& _.filter(colony.flags, flag => DirectiveColonize.filter(flag)).length == 0) {
				possibleColonizers.push(colony);
			}
		}
		let possibleBestExpansions = _.compact(_.map(possibleColonizers, col => this.getBestExpansionRoomFor(col)));
		log.debug(JSON.stringify(possibleBestExpansions));
		let bestExpansion = maxBy(possibleBestExpansions, choice => choice!.score);
		if (bestExpansion) {
			log.alert(`Next expansion chosen: ${bestExpansion.roomName} with score ${bestExpansion.score}`);
			return bestExpansion.roomName;
		} else {
			log.alert(`No viable expansion rooms found!`);
		}
	}

	private getBestExpansionRoomFor(colony: Colony): { roomName: string, score: number } | undefined {
		let allColonyRooms = _.zipObject(_.map(getAllColonies(),
											   col => [col.room.name, true])) as { [roomName: string]: boolean };
		let allOwnedMinerals = _.map(getAllColonies(), col => col.room.mineral!.mineralType) as MineralConstant[];
		let bestRoom: string = '';
		let bestScore: number = -Infinity;
		for (let roomName in colony.memory.expansionData.possibleExpansions) {
			let score = colony.memory.expansionData.possibleExpansions[roomName] as number | boolean;
			if (typeof score != 'number') continue;
			// Compute modified score
			if (score + MAX_SCORE_BONUS > bestScore) {
				// Is the room too close to an existing colony?
				let range2Rooms = Cartographer.findRoomsInRange(roomName, MIN_EXPANSION_DISTANCE);
				if (_.any(range2Rooms, roomName => allColonyRooms[roomName])) {
					continue; // too close to another colony
				}
				let range3Rooms = Cartographer.findRoomsInRange(roomName, MIN_EXPANSION_DISTANCE + 1);
				if (_.any(range3Rooms, roomName => allColonyRooms[roomName])) {
					score -= TOO_CLOSE_PENALTY;
				}
				// Are there powerful hostile rooms nearby?
				let adjacentRooms = Cartographer.findRoomsInRange(roomName, 1);
				if (_.any(adjacentRooms, roomName => Memory.rooms[roomName][_RM.AVOID])) {
					continue;
				}

				// Are there other Overmind users nearby?
				if (_.any(adjacentRooms, roomName => typeof Game.rooms[roomName].owner === 'string' && Game.rooms[roomName].owner != MY_USERNAME && Assimilator.isAssimilated(Game.rooms[roomName].owner!))) {
					score -= TOO_CLOSE_PENALTY;
					log.debug(`Strategist triggered too close to overmind user ${Game.rooms[roomName].owner} for ${roomName}`)
				}

				// Reward new minerals and catalyst rooms
				let mineralType = Memory.rooms[roomName][_RM.MINERAL]
								  ? Memory.rooms[roomName][_RM.MINERAL]![_RM_MNRL.MINERALTYPE]
								  : undefined;
				if (mineralType) {
					if (!allOwnedMinerals.includes(mineralType)) {
						score += UNOWNED_MINERAL_BONUS;
					}
					if (mineralType == RESOURCE_CATALYST) {
						score += CATALYST_BONUS;
					}
				}
				// Update best choices
				if (score > bestScore && Game.map.isRoomAvailable(roomName)) {
					bestScore = score;
					bestRoom = roomName;
				}
			}
		}
		if (bestRoom != '') {
			return {roomName: bestRoom, score: bestScore};
		}
	}

	init(): void {

	}

	run(): void {
		if (Game.time % CHECK_EXPANSION_FREQUENCY == 17 && getAutonomyLevel() == Autonomy.Automatic) {
			this.handleExpansion();
		}
	}

}
