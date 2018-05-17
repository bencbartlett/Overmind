// Combat Intel - provides information related to making combat-related decisions

import {Directive} from '../directives/Directive';
import {Mem} from '../memory';
import {Colony} from '../Colony';
import {Traveler} from '../lib/traveler/Traveler';

interface CombatIntelMemory {
	cache: {
		tick: number,

	}
}

export class CombatIntel {

	directive: Directive;
	room: Room | undefined;
	colony: Colony;

	constructor(directive: Directive) {
		this.directive = directive;
		this.room = directive.room;
		this.colony = directive.colony;
	}

	get memory(): CombatIntelMemory {
		return Mem.wrap(this.directive.memory, 'combatIntel', {});
	}

	// Tower damage ====================================================================================================

	/* Get the tower damage at a given range */
	static singleTowerDamage(range: number): number {
		if (range <= TOWER_OPTIMAL_RANGE) {
			return TOWER_POWER_ATTACK;
		}
		range = Math.min(range, TOWER_FALLOFF_RANGE);
		let falloff = (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
		return TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF * falloff);
	}

	/* Total tower tamage from all towers in room at a given position */
	static towerDamageAtPos(pos: RoomPosition): number | undefined {
		let room = Game.rooms[pos.roomName];
		if (room) {
			let expectedDamage = 0;
			for (let tower of room.towers) {
				if (!tower.my && tower.energy > 0) {
					expectedDamage += this.singleTowerDamage(pos.getRangeTo(tower));
				}
			}
			return expectedDamage;
		}
	}

	private computeCostMatrix(): CostMatrix | undefined {
		if (this.room) {
			let matrix = new PathFinder.CostMatrix();
			let barriers = this.room.barriers;
			if (barriers.length > 0) {
				let highestHits = _.last(_.sortBy(barriers, barrier => barrier.hits)).hits;
				for (let barrier of barriers) {
					matrix.set(barrier.pos.x, barrier.pos.y, Math.ceil(barrier.hits * 10 / highestHits) * 10);
				}
			}
			return matrix;
		}
	}

	private findBestExit(matrix: CostMatrix, towers: StructureTower[], spawns: StructureSpawn[]): RoomPosition | undefined {
		if (!this.room) {
			return;
		}
		let bestExit: RoomPosition | undefined;
		let destination = this.room.spawns[0] || this.room.storage; // enemy structure you are trying to get to
		if (!destination) {
			return;
		}
		let ret = PathFinder.search(this.colony.pos, {pos: destination.pos, range: 1}, {
			roomCallback: (roomName: string): CostMatrix | boolean => {
				if (roomName != this.room!.name && Traveler.checkAvoid(roomName)) {
					return false;
				} else {
					return Traveler.getStructureMatrix(Game.rooms[roomName]);
				}
			},
		});
		if (!ret.incomplete) {
			bestExit = _.find(ret.path, p => p.roomName == this.room!.name);
		}

		// Figure out possible exits to go from enemy room back to colony in a reasonable amount of time
		let maxRoomDistance = 8;
		let allowedExits: { [direction: string]: boolean } = {};
		if (!bestExit) {
			let exitData = Game.map.describeExits(this.room.name);
			for (let direction in exitData) {
				let roomName = exitData[<'1' | '3' | '5' | '7'>direction] as string;
				let allowedRooms = Traveler.findRoute(this.colony.name, roomName);
				if (allowedRooms && Object.keys(allowedRooms).length <= maxRoomDistance) {
					allowedExits[direction] = true;
				}
			}
			if (_.keys(allowedExits).length == 0) {
				return;
			}
		}

		// TODO
		let exitPositions: RoomPosition[] = [];
		for (let x = 0; x < 50; x++) {
			for (let y = 0; y < 50; y++) {
				if (x !== 0 && y !== 0 && x !== 49 && y !== 49) {
					continue;
				}
				if (Game.map.getTerrainAt(x, y, this.room.name) === 'wall') {
					continue;
				}
				matrix.set(x, y, 0xff);
				if (bestExit) {
					continue;
				}
				if (allowedExits['1'] && y === 0) {
					exitPositions.push(new RoomPosition(x, y, this.room.name));
				} else if (allowedExits['3'] && x === 49) {
					exitPositions.push(new RoomPosition(x, y, this.room.name));
				} else if (allowedExits['5'] && y === 49) {
					exitPositions.push(new RoomPosition(x, y, this.room.name));
				} else if (allowedExits['7'] && x === 0) {
					exitPositions.push(new RoomPosition(x, y, this.room.name));
				}
			}
		}

		if (!bestExit) {
			bestExit = _(exitPositions)
				.sortBy((p: RoomPosition) => -_.sum(towers, (t: Structure) => p.getRangeTo(t)))
				.head();
		}
		matrix.set(bestExit.x, bestExit.y, 1);

		return bestExit;
	}


}