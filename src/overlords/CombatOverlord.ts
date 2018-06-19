import {profile} from '../profiler/decorator';
import {Overlord} from './Overlord';
import {Zerg} from '../Zerg';
import {Pathing} from '../movement/Pathing';
import {Directive} from '../directives/Directive';
import {WorldMap} from '../utilities/WorldMap';
import {log} from '../console/log';
import {AttackStructurePriorities} from '../priorities/priorities_structures';

export interface CombatOverlordMemory extends OverlordMemory {
	fallback?: protoPos;
}

@profile
export abstract class CombatOverlord extends Overlord {

	memory: CombatOverlordMemory;
	directive: Directive;
	moveOpts: MoveOptions;

	constructor(directive: Directive, name: string, priority: number) {
		super(directive, name, priority);
		this.directive = directive;
		this.moveOpts = {

		};
	}

	findPartner(zerg: Zerg, partners: Zerg[], tickDifference = 600): Zerg | undefined {
		if (zerg.memory.partner) {
			let partner = _.find(partners, partner => partner.name == zerg.memory.partner);
			if (partner) {
				return partner;
			} else {
				delete zerg.memory.partner;
				this.findPartner(zerg, partners, tickDifference);
			}
		} else {
			let partner = _.find(partners, partner => partner.memory.partner == zerg.name);
			if (!partner) {
				partner = _(partners)
					.filter(partner => !partner.memory.partner && !partner.spawning &&
									   Math.abs(zerg.ticksToLive! - partner.ticksToLive!) <= tickDifference)
					.min(partner => Math.abs(zerg.ticksToLive! - partner.ticksToLive!));
			}
			if (_.isObject(partner)) {
				zerg.memory.partner = partner.name;
				partner.memory.partner = zerg.name;
				return partner;
			}
		}
	}

	findClosestHostile(zerg: Zerg, checkReachable = false, ignoreCreepsAtEdge = true): Creep | undefined {
		if (zerg.room.hostiles.length > 0) {
			let targets: Creep[];
			if (ignoreCreepsAtEdge) {
				targets = _.filter(zerg.room.hostiles, hostile => hostile.pos.rangeToEdge > 0);
			} else {
				targets = zerg.room.hostiles;
			}
			if (checkReachable) {
				let targetsByRange = _.sortBy(targets, target => zerg.pos.getRangeTo(target));
				return _.find(targetsByRange, target => Pathing.isReachable(zerg.pos, target.pos));
			} else {
				return zerg.pos.findClosestByRange(targets);
			}
		}
	}

	/* This method is expensive */
	findClosestReachable(pos: RoomPosition, targets: (Creep | Structure)[]): Creep | Structure | undefined {
		let targetsByRange = _.sortBy(targets, target => pos.getRangeTo(target));
		return _.find(targetsByRange, target => Pathing.isReachable(pos, target.pos));
	}

	findClosestPrioritizedStructure(zerg: Zerg, checkReachable = false): Structure | undefined {
		for (let structureType of AttackStructurePriorities) {
			let structures = _.filter(zerg.room.hostileStructures, s => s.structureType == structureType);
			if (structures.length == 0) continue;
			if (checkReachable) {
				let closestReachable = this.findClosestReachable(zerg.pos, structures) as Structure | undefined;
				if (closestReachable) return closestReachable;
			} else {
				return zerg.pos.findClosestByRange(structures);
			}
		}
	}

	findClosestHurtFriendly(healer: Zerg): Creep | undefined {
		return healer.pos.findClosestByRange(_.filter(healer.room.creeps, creep => creep.hits < creep.hitsMax));
	}

	/* Move to and heal/rangedHeal the specified target */
	medicActions(healer: Zerg): void {
		let target = this.findClosestHurtFriendly(healer);
		if (target) {
			// Approach the target
			let range = healer.pos.getRangeTo(target);
			if (range > 1) {
				healer.goTo(target, {movingTarget: true});
			}

			// Heal or ranged-heal the target
			if (range <= 1) {
				healer.heal(target);
			} else if (range <= 3) {
				healer.rangedHeal(target);
			}
		} else {
			healer.park();
		}
	}

	healSelfIfPossible(zerg: Zerg): CreepActionReturnCode | undefined {
		// Heal yourself if it won't interfere with attacking
		if (zerg.hits < zerg.hitsMax && zerg.canExecute('heal')) {
			return zerg.heal(zerg);
		}
	}

	/* Attack and chase the specified target */
	attackAndChase(zerg: Zerg, target: Creep | Structure): CreepActionReturnCode {
		let ret: CreepActionReturnCode;
		// Attack the target if you can, else move to get in range
		if (zerg.pos.isNearTo(target)) {
			ret = zerg.attack(target);
			// Move in the direction of the creep to prevent it from running away
			zerg.move(zerg.pos.getDirectionTo(target));
			return ret;
		} else {
			if (target instanceof Creep) {
				zerg.goTo(target, _.merge(this.moveOpts, {movingTarget: true}));
			} else {
				zerg.goTo(target, this.moveOpts);
			}
			return ERR_NOT_IN_RANGE;
		}
	}

	/* Fallback is a location on the other side of the nearest exit the directive is placed at */
	get fallback(): RoomPosition {
		let {x, y, roomName} = this.directive.pos;
		let rangesToExit = [[x, 'left'], [49 - x, 'right'], [y, 'top'], [49 - y, 'bottom']];
		let [range, direction] = _.first(_.sortBy(rangesToExit, pair => pair[0]));
		switch (direction) {
			case 'left':
				x = 48;
				roomName = WorldMap.findRelativeRoomName(roomName, -1, 0);
				break;
			case 'right':
				x = 1;
				roomName = WorldMap.findRelativeRoomName(roomName, 1, 0);
				break;
			case 'top':
				y = 48;
				roomName = WorldMap.findRelativeRoomName(roomName, 0, -1);
				break;
			case 'bottom':
				y = 1;
				roomName = WorldMap.findRelativeRoomName(roomName, 0, 1);
				break;
			default:
				log.error('Error getting fallback position!');
				break;
		}
		return new RoomPosition(x, y, roomName);
	}

}