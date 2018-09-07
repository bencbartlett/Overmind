import {CombatZerg} from './CombatZerg';
import {Movement, MoveOptions} from '../movement/Movement';

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
	formation: CombatZerg[][];					// Relative ordering of the creeps assuming a TOP orientation
	width: number;								// Width of the formation
	height: number;								// Height of the formation
	anchor: RoomPosition;						// Anchor is always the top left creep position
	positions: RoomPosition[];					// Positions of all creeps
	orientation: TOP | BOTTOM | LEFT | RIGHT;	// Direction the swarm is facing
	fatigue: number;							// Maximum fatigue of all creeps in the swarm
	memory: SwarmMemory;

	constructor(creeps: CombatZerg[]) {
		this.creeps = creeps;
	}


	// Movement methods ================================================================================================

	assemble(assemblyPoint: RoomPosition) {

	}

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
