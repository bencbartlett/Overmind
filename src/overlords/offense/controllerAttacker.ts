import {Zerg} from '../../zerg/Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {Overlord} from '../Overlord';
import {DirectiveControllerAttack} from '../../directives/offense/controllerAttack';
import {profile} from '../../profiler/decorator';
import {SpawnGroup} from 'logistics/SpawnGroup';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';

/**
 * Controller attacker overlord.  Spawn CLAIM creeps to mass up on a controller and attack all at once
 * This module was contributed by @sarrick and has since been modified
 */
@profile
export class ControllerAttackerOverlord extends Overlord {

	controllerAttackers: Zerg[];
	attackPositions: RoomPosition[];
	assignments: { [attackerName: string]: RoomPosition };
	readyTick: number;

	constructor(directive: DirectiveControllerAttack, priority = OverlordPriority.offense.controllerAttack) {
		super(directive, 'controllerAttack', priority);
		this.controllerAttackers = this.zerg(Roles.claim);
		this.spawnGroup = new SpawnGroup(this, {requiredRCL: 4});
		this.refresh();
	}

	refresh() {
		super.refresh();
		if (this.room && this.room.controller) {
			this.attackPositions = this.room.controller.pos.availableNeighbors(true);
			this.readyTick = Game.time + (this.room.controller.upgradeBlocked || 0);
		} else {
			this.attackPositions = [];
			this.readyTick = Game.time;
		}
		this.assignments = this.getPositionAssignments();
	}

	private getPositionAssignments(): { [attackerName: string]: RoomPosition } {
		let assignments: { [attackerName: string]: RoomPosition } = {};
		let maxLoops = Math.min(this.attackPositions.length, this.controllerAttackers.length);
		let controllerAttackers = _.sortBy(this.controllerAttackers, zerg => zerg.name);
		for (let i = 0; i < maxLoops; i++) {
			assignments[controllerAttackers[i].name] = this.attackPositions[i];
		}
		return assignments;
	}

	init() {
		// TODO: Prespawn attackers to arrive as cooldown disappears
		if (this.attackPositions.length > 0 && Game.time >= this.readyTick) {
			this.wishlist(this.attackPositions.length, Setups.infestors.controllerAttacker, {noLifetimeFilter: true});
		}
	}

	run() {
		for (let controllerAttacker of this.controllerAttackers) {
			let attackPos = this.assignments[controllerAttacker.name];
			if (attackPos) {
				controllerAttacker.goTo(attackPos);
			} else {
				log.debug(`No attack position for ${controllerAttacker.print}!`);
			}
		}
		if (this.room && this.room.controller && !this.room.controller.upgradeBlocked) {
			if (_.all(this.controllerAttackers, creep => creep.pos.isEqualTo(this.assignments[creep.name]))
				|| _.any(this.controllerAttackers, creep => creep.pos.isNearTo(this.room!.controller!)
															&& (creep.ticksToLive || 10) <= 2)) {
				this.launchAttack();
			}
		}
	}

	private launchAttack(): void {
		let signed = false;
		if (this.room && this.room.controller) {
			for (let infestor of this.controllerAttackers) {
				infestor.attackController(this.room.controller);
				if (!signed) {
					signed = (infestor.signController(this.room.controller, 'For the swarm') == OK);
				}
			}
		}
	}

}
