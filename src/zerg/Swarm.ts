import {CombatZerg} from './CombatZerg';

export interface ProtoSwarm {
	creeps: Creep[] | CombatZerg[]
}


// Represents a coordinated group of creeps moving as a single unit
export class Swarm implements ProtoSwarm { // TODO: incomplete

	creeps: CombatZerg[];

	constructor(creeps: CombatZerg[]) {
		this.creeps = creeps;
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
