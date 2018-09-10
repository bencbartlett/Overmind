import {CombatZerg} from './CombatZerg';
import {Movement, MoveOptions} from '../movement/Movement';
import {hasPos} from '../declarations/typeGuards';

export interface ProtoSwarm {
	creeps: Creep[] | CombatZerg[]
}

interface SwarmMemory {
	_go?: MoveData;
}

const ERR_NOT_ALL_OK = -7;

// Represents a coordinated group of creeps moving as a single unit
export class Swarm implements ProtoSwarm { // TODO: incomplete

	creeps: CombatZerg[];						// All creeps involved in the swarm
	leader: CombatZerg;							// Leader is top left creep when orientation is TOP; rotates accordingly
	formation: (CombatZerg | undefined)[][]; 					// Relative ordering of the creeps accounting for orientation
	staticFormation: (CombatZerg | undefined)[][];			// Relative ordering of the creeps assuming a TOP orientation
	width: number;								// Width of the formation
	height: number;								// Height of the formation
	anchor: RoomPosition;						// Anchor is always top left creep position regardless of orientation
	positions: RoomPosition[];					// Positions of all creeps
	rooms: { [roomName: string]: Room };
	orientation: TOP | BOTTOM | LEFT | RIGHT;	// Direction the swarm is facing
	fatigue: number;							// Maximum fatigue of all creeps in the swarm
	memory: SwarmMemory;

	constructor(creeps: CombatZerg[]) {
		this.creeps = creeps;
	}

	// Range finding methods ===========================================================================================

	minRangeTo(obj: RoomPosition | HasPos): number {
		if (hasPos(obj)) {
			return _.min(_.map(this.creeps, creep =>
				creep.pos.roomName === obj.pos.roomName ? creep.pos.getRangeToXY(obj.pos.x, obj.pos.y) : Infinity));
		} else {
			return _.min(_.map(this.creeps, creep =>
				creep.pos.roomName === obj.roomName ? creep.pos.getRangeToXY(obj.x, obj.y) : Infinity));
		}
	}

	maxRangeTo(obj: RoomPosition | HasPos): number {
		if (hasPos(obj)) {
			return _.max(_.map(this.creeps, creep =>
				creep.pos.roomName === obj.pos.roomName ? creep.pos.getRangeToXY(obj.pos.x, obj.pos.y) : Infinity));
		} else {
			return _.max(_.map(this.creeps, creep =>
				creep.pos.roomName === obj.roomName ? creep.pos.getRangeToXY(obj.x, obj.y) : Infinity));
		}
	}

	// Formation methods ===============================================================================================

	// Generates a table of formation positions for each creep
	private getFormationPositionsFromAnchor(anchor: RoomPosition): { [creepName: string]: RoomPosition } {
		let formationPositions: { [creepName: string]: RoomPosition } = {};
		for (let i = 0; i < this.formation.length; i++) {
			for (let j = 0; j < this.formation[i].length; j++) {
				if (this.formation[i][j]) {
					formationPositions[this.formation[i][j]!.name] = anchor.getOffsetPos(i, j);
				}
			}
		}
		return formationPositions;
	}

	// If the swarm is currently in formation
	isInFormation(anchor = this.anchor): boolean {
		const formationPositions = this.getFormationPositionsFromAnchor(anchor);
		return _.all(this.creeps, creep => creep.pos.isEqualTo(formationPositions[creep.name]));
	}

	// Assemble the swarm at the target location
	assemble(assemblyPoint: RoomPosition): boolean {
		if (this.isInFormation(assemblyPoint)) {
			return true;
		} else {
			// Creeps travel to their relative formation positions
			const formationPositions = this.getFormationPositionsFromAnchor(assemblyPoint);
			for (let creep of this.creeps) {
				const destination = formationPositions[creep.name];
				creep.goTo(destination, {
					noPush: creep.pos.inRangeToPos(destination, 5),
					// ignoreCreeps: !creep.pos.inRangeToPos(destination, Math.max(this.width, this.height))
				});
			}
			return false;
		}
	}

	private findRegroupPosition(): RoomPosition {
		let x, y: number;
		const MAX_RADIUS = 10;
		for (let radius = 0; radius < MAX_RADIUS; radius++) {
			for (let dx = -radius; dx <= radius; dx++) {
				for (let dy = -radius; dy <= radius; dy++) {
					if (Math.abs(dy) !== radius && Math.abs(dx) !== radius) {
						continue;
					}
					x = this.anchor.x + dx;
					y = this.anchor.y + dy;
					if (x < 0 || x > 49 || y < 0 || y > 49) {
						continue;
					}
					let allPathable = true;
					let pos = new RoomPosition(x, y, this.anchor.roomName);
					for (let i = 0; i < this.formation.length; i++) {
						for (let j = 0; j < this.formation[i].length; j++) {
							if (!pos.getOffsetPos(i, j).isWalkable(true)) {
								allPathable = false;
							}
						}
					}
					if (allPathable) {
						return pos;
					}
				}
			}
		}
		// Should never reach here!
		return new RoomPosition(-10, -10, 'cannotFindLocationPosition');
	}

	// Try to re-assemble the swarm at the nearest possible location in case it broke formation
	regroup(): boolean {
		if (this.isInFormation(this.anchor)) {
			return true;
		} else {
			let regroupPosition = this.findRegroupPosition();
			return this.assemble(regroupPosition);
		}
	}

	// Movement methods ================================================================================================

	move(direction: DirectionConstant): number {
		let allMoved = true;
		for (let creep of this.creeps) {
			let result = creep.move(direction);
			if (result != OK) {
				allMoved = false;
			}
		}
		if (!allMoved) {
			for (let creep of this.creeps) {
				creep.cancelOrder('move');
			}
		}
		return allMoved ? OK : ERR_NOT_ALL_OK;
	}

	goTo(destination: RoomPosition | HasPos, options: MoveOptions = {}) {
		return Movement.swarmMove(this, destination, options);
	}

	static findEnemySwarms(room: Room): ProtoSwarm[] {
		let enemySwarms: ProtoSwarm[] = [];
		let origin = _.first(room.spawns) || room.controller || {pos: new RoomPosition(25, 25, room.name)};
		let attackers = _.sortBy(room.hostiles, creep => origin.pos.getRangeTo(creep));
		while (attackers.length > 0) {
			let clump = _.first(attackers).pos.findInRange(attackers, 4);
			attackers = _.difference(attackers, clump);
			enemySwarms.push({creeps: clump});
		}
		return enemySwarms;
	}

}
