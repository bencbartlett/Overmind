import {CombatZerg} from './CombatZerg';
import {CombatMoveOptions, Movement, NO_ACTION, SwarmMoveOptions} from '../movement/Movement';
import {hasPos} from '../declarations/typeGuards';
import {rotatedMatrix} from '../utilities/utils';
import {Mem} from '../memory/Memory';
import {CombatOverlord} from '../overlords/CombatOverlord';
import {CombatIntel} from '../intel/CombatIntel';
import {log} from '../console/log';
import {GoalFinder} from '../targeting/GoalFinder';
import {CombatTargeting} from '../targeting/CombatTargeting';
import {Pathing} from '../movement/Pathing';
import {normalizePos} from '../movement/helpers';

export interface ProtoSwarm {
	creeps: Creep[] | CombatZerg[]
}

interface SwarmMemory {
	_go?: MoveData;
	creeps: string[];
	orientation: TOP | BOTTOM | LEFT | RIGHT;
	targetID?: string;
	numRetreats: number;
	initialAssembly?: boolean;
	recovering?: boolean;
	lastInDanger?: number;
}

const SwarmMemoryDefaults: SwarmMemory = {
	creeps     : [],
	orientation: TOP,
	numRetreats: 0,
};

const ERR_NOT_ALL_OK = -7;

interface SwarmOverlord extends CombatOverlord {
	memory: any;
}

// Represents a coordinated group of creeps moving as a single unit
export class Swarm implements ProtoSwarm { // TODO: incomplete

	private overlord: SwarmOverlord;
	memory: SwarmMemory;
	ref: string;
	creeps: CombatZerg[];							// All creeps involved in the swarm
	formation: (CombatZerg | undefined)[][]; 		// Relative ordering of the creeps accounting for orientation
	staticFormation: (CombatZerg | undefined)[][];	// Relative ordering of the creeps assuming a TOP orientation
	width: number;									// Width of the formation
	height: number;									// Height of the formation
	anchor: RoomPosition;							// Top left position of the formation regardless of orientation
	rooms: Room[];
	roomsByName: { [roomName: string]: Room };
	fatigue: number;								// Maximum fatigue of all creeps in the swarm

	constructor(overlord: SwarmOverlord, ref: string, creeps: CombatZerg[], width = 2, height = 2) {
		this.overlord = overlord;
		this.ref = ref;
		this.memory = Mem.wrap(overlord.memory, `swarm:${ref}`, SwarmMemoryDefaults);
		// Build the static formation by putting attackers at the front and healers at the rear
		let paddedCreeps: (CombatZerg | undefined)[] = _.clone(creeps);
		for (let i = paddedCreeps.length; i < width * height; i++) {
			paddedCreeps.push(undefined); // fill in remaining positions with undefined
		}
		let sortedCreeps = _.sortBy(paddedCreeps, function (z) {
			if (z == undefined) {
				return 0;
			} else {
				let score = CombatIntel.getAttackPotential(z.creep) + CombatIntel.getRangedAttackPotential(z.creep)
							+ CombatIntel.getDismantlePotential(z.creep) - CombatIntel.getHealPotential(z.creep);
				return (-1 * score) || 1;
			}
		});
		this.staticFormation = _.chunk(sortedCreeps, width);
		this.width = width;
		this.height = height;
		let firstCreepIndex = _.findIndex(sortedCreeps);
		let leadPos: RoomPosition; // upper left corner of formation when in TOP orientation
		if (firstCreepIndex != -1) {
			let firstCreepPos = sortedCreeps[firstCreepIndex]!.pos;
			let dx = firstCreepIndex % width;
			let dy = Math.floor(firstCreepIndex / width);
			leadPos = firstCreepPos.getOffsetPos(-dx, -dy);
		} else {
			leadPos = this.overlord.pos;
		}
		switch (this.orientation) {
			case TOP:
				this.anchor = leadPos;
				break;
			case RIGHT:
				this.anchor = leadPos.getOffsetPos(-1 * (height - 1), 0);
				break;
			case BOTTOM:
				this.anchor = leadPos.getOffsetPos(-1 * (width - 1), -1 * (height - 1));
				break;
			case LEFT:
				this.anchor = leadPos.getOffsetPos(0, -1 * (width - 1));
				break;
		}
		this.formation = rotatedMatrix(this.staticFormation, this.rotationsFromOrientation());
		this.creeps = creeps;
		this.rooms = _.unique(_.map(this.creeps, creep => creep.room), room => room.name);
		this.roomsByName = _.zipObject(_.map(this.rooms, room => [room.name, room]));
		this.fatigue = _.max(_.map(this.creeps, creep => creep.fatigue));
		log.debug(`Anchor: ${this.anchor.print}`);
		log.debug(`Formation: ${_.map(this.formation, creeps => _.map(creeps, creep => creep ? creep.name : 'none'))}`);
		log.debug(`StaticFormation: ${_.map(this.staticFormation, creeps => _.map(creeps, creep => creep ? creep.name : 'none'))}`);

	}

	get target(): Creep | Structure | undefined {
		let target = Game.getObjectById(this.memory.targetID);
		if (target) {
			return target as Creep | Structure;
		}
	}

	set target(targ: Creep | Structure | undefined) {
		if (targ) {
			this.memory.targetID = targ.id;
		} else {
			delete this.memory.targetID;
		}
	}

	get orientation(): TOP | BOTTOM | LEFT | RIGHT {
		return this.memory.orientation;
	}

	set orientation(direction: TOP | BOTTOM | LEFT | RIGHT) {
		this.memory.orientation = direction;
		this.formation = rotatedMatrix(this.staticFormation, this.rotationsFromOrientation());
	}

	// Number of clockwise 90 degree turns corresponding to an orientation
	private rotationsFromOrientation(): 0 | 1 | 2 | 3 {
		switch (this.memory.orientation) {
			case TOP:
				return 0;
			case RIGHT:
				return 1;
			case BOTTOM:
				return 2;
			case LEFT:
				return 3;
		}
	}

	// Swarm assignment ================================================================================================


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

	findInMinRange(targets: HasPos[], range: number): HasPos[] {
		let initialRange = range + Math.max(this.width, this.height) - 1;
		let targetsInRange = _.filter(targets, t => this.anchor.inRangeToXY(t.pos.x, t.pos.y, initialRange));
		return _.filter(targetsInRange, t => this.minRangeTo(t) <= range);
	}

	// Compute the "average" direction to a target
	getDirectionTo(obj: RoomPosition | HasPos): DirectionConstant {
		let pos = normalizePos(obj);
		let directions = _.map(this.creeps, creep => creep.pos.getDirectionTo(obj));
		// TODO
		log.warning(`NOT IMPLEMENTED`);
		return TOP;
	}

	// Formation methods ===============================================================================================

	// Generates a table of formation positions for each creep
	private getFormationPositionsFromAnchor(anchor: RoomPosition): { [creepName: string]: RoomPosition } {
		let formationPositions: { [creepName: string]: RoomPosition } = {};
		for (let dy = 0; dy < this.formation.length; dy++) {
			for (let dx = 0; dx < this.formation[dy].length; dx++) {
				if (this.formation[dy][dx]) {
					formationPositions[this.formation[dy][dx]!.name] = anchor.getOffsetPos(dx, dy);
				}
			}
		}
		log.debug(`Formation positions: `, JSON.stringify(formationPositions));
		return formationPositions;
	}

	// If every creep in the swarm is in the position dictated by formation
	isInFormation(anchor = this.anchor): boolean {
		const formationPositions = this.getFormationPositionsFromAnchor(anchor);
		return _.all(this.creeps, creep => creep.pos.isEqualTo(formationPositions[creep.name]));
	}

	get hasMaxCreeps(): boolean {
		return this.creeps.length == this.width * this.height;
	}

	get inMultipleRooms(): boolean {
		return _.keys(this.roomsByName).length > 1;
	}

	// Assemble the swarm at the target location
	assemble(assemblyPoint: RoomPosition, allowIdleCombat = true): boolean {
		if (this.isInFormation(assemblyPoint) && this.hasMaxCreeps) {
			return true;
		} else {
			// Creeps travel to their relative formation positions
			const formationPositions = this.getFormationPositionsFromAnchor(assemblyPoint);
			for (let creep of this.creeps) {
				if (allowIdleCombat && creep.room.dangerousPlayerHostiles.length > 0) {
					creep.autoSkirmish(creep.room.name);
				} else {
					const destination = formationPositions[creep.name];
					creep.goTo(destination, {
						noPush: creep.pos.inRangeToPos(destination, 5),
						// ignoreCreeps: !creep.pos.inRangeToPos(destination, Math.max(this.width, this.height))
					});
				}
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
			log.debug(`Reassembling at ${regroupPosition.print}`);
			return this.assemble(regroupPosition, false);
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
		let result = allMoved ? OK : ERR_NOT_ALL_OK;
		log.debug(`MOVE result: ${result}`);
		return result;
	}

	goTo(destination: RoomPosition | HasPos, options: SwarmMoveOptions = {}): number {
		return Movement.swarmMove(this, destination, options);
	}

	goToRoom(roomName: string, options: SwarmMoveOptions = {}): number {
		return Movement.goToRoom_swarm(this, roomName, options);
	};

	combatMove(approach: PathFinderGoal[], avoid: PathFinderGoal[], options: CombatMoveOptions = {}): number {
		return Movement.swarmCombatMove(this, approach, avoid, options);
	}

	safelyInRoom(roomName: string): boolean {
		return _.all(this.creeps, creep => creep.safelyInRoom(roomName));
	}

	private getBestOrientation(room: Room): TOP | RIGHT | BOTTOM | LEFT {
		let structureTargets = this.findInMinRange(room.hostileStructures, 1);
		log.debug(`StructureTargets: `, _.map(structureTargets, t => t.pos.print));
		let dxList = _.flatten(_.map(this.creeps,
									 creep => _.map(structureTargets,
													target => target.pos.x - creep.pos.x))) as number[];
		let dyList = _.flatten(_.map(this.creeps,
									 creep => _.map(structureTargets,
													target => target.pos.y - creep.pos.y))) as number[];
		let dx = _.sum(dxList) / dxList.length || 0;
		let dy = _.sum(dyList) / dyList.length || 0;
		log.debug(`dx: ${dx}, dy: ${dy}`);
		if (Math.abs(dx) > Math.abs(dy)) {
			return dx > 0 ? RIGHT : LEFT;
		} else {
			return dy > 0 ? BOTTOM : TOP;
		}
	}

	// Auto-combat methods =============================================================================================

	autoMelee() {
		for (let creep of this.creeps) {
			if (creep.getActiveBodyparts(ATTACK) > 0) {
				creep.autoMelee();
			}
		}
	}

	autoRanged() {
		for (let creep of this.creeps) {
			if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
				creep.autoRanged();
			}
		}
	}

	autoHeal(allowRangedHeal = true) {
		for (let creep of this.creeps) {
			if (creep.getActiveBodyparts(HEAL) > 0) {
				creep.autoHeal(allowRangedHeal);
			}
		}
	}

	/* Standard sequence of actions for sieging a room. Assumes the swarm has already initially assembled. */
	autoSiege(roomName: string) {
		this.autoMelee();
		this.autoRanged();
		this.autoHeal();

		if (!this.isInFormation()) {
			return this.regroup();
		}

		// Handle recovery if low on HP
		if (this.needsToRecover()) {
			log.debug(`Recovering!`);
			this.target = undefined; // invalidate target
			return this.recover();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			log.debug(`Going to room!`);
			return this.goToRoom(roomName);
		}

		// Find a target if needed
		if (!this.target) {
			this.target = CombatTargeting.findBestSwarmStructureTarget(this, roomName, 10 * this.memory.numRetreats);
			log.debug(this.target);
		}

		// Approach the siege target
		if (this.target) {
			let approach = _.map(Pathing.getPosWindow(this.target.pos, -this.width, -this.height),
								 pos => ({pos: pos, range: 1}));
			let result = this.combatMove(approach, []);
			if (result != NO_ACTION) {
				log.debug(`Moving to target: ${result}`);
				return result;
			}
		} else {
			log.warning(`No target for swarm ${this.ref}!`);
		}

		// Orient yourself to face structure targets
		let targetRoom = _.find(this.rooms, room => room.owner && !room.my);
		if (targetRoom) {
			this.orientation = this.getBestOrientation(targetRoom);
			if (!this.isInFormation()) {
				log.debug(`Reorienting!`);
				return this.regroup();
			}
		}

		log.debug(`No further action needed`);
	}

	needsToRecover(recoverThreshold = 0.75, reengageThreshold = 1.0): boolean {
		let recovering: boolean;
		if (this.memory.recovering) {
			recovering = _.any(this.creeps, creep => creep.hits < creep.hitsMax * reengageThreshold);
		} else {
			recovering = _.any(this.creeps, creep => creep.hits < creep.hitsMax * recoverThreshold);
		}
		if (recovering && recovering != this.memory.recovering) {
			this.memory.numRetreats++;
		}
		this.memory.recovering = recovering;
		return recovering;
	}

	recover() {
		let allHostiles = _.flatten(_.map(this.rooms, room => room.hostiles));
		let allTowers = _.flatten(_.map(this.rooms, room => room.owner && !room.my ? room.towers : []));
		if (_.filter(allHostiles, h => this.minRangeTo(h)).length > 0 || allTowers.length > 0) {
			this.memory.lastInDanger = Game.time;
		}
		let allAvoidGoals = _.flatten(_.map(this.rooms, room => GoalFinder.retreatGoals(room).avoid));
		let result = Movement.swarmCombatMove(this, [], allAvoidGoals);

		let safeRoom = _.first(_.filter(this.rooms, room => !room.owner || room.my));

		if (result == NO_ACTION && safeRoom && !this.safelyInRoom(safeRoom.name)) {
			if (Game.time < (this.memory.lastInDanger || 0) + 3) {
				return this.goToRoom(safeRoom.name);
			}
		}
		return result;
	}


	// Simulated swarms ================================================================================================

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
