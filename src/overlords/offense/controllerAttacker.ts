// Controller attacker overlord.  Spawn CLAIM creeps to mass up on a controller and attack all at once

import {Zerg} from '../../zerg/Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {Overlord} from '../Overlord';
import {DirectiveControllerAttack, DirectiveControllerAttackMemory} from '../../directives/offense/controllerAttack';
import {CreepSetup} from '../CreepSetup';
import {profile} from '../../profiler/decorator';
import {log} from '../../console/log';
import {SpawnGroup} from 'logistics/SpawnGroup';

const InfestorSetup = new CreepSetup('infestor', {
	pattern: [CLAIM, MOVE],
	sizeLimit: Infinity,
	ordered: true
});

interface ControllerAttackerMemory extends CreepMemory {
	attackPosition: protoPos;
}

@profile
export class ControllerAttackerOverlord extends Overlord {

	infestors: ControllerAttackerZerg[];
	scouts: Zerg[];
	attackPositions: RoomPosition[];
	readyTick: number;
	directiveMemory: DirectiveControllerAttackMemory;

	constructor(directive: DirectiveControllerAttack, priority = OverlordPriority.offense.controllerAttack) {
		super(directive, 'controllerAttack', priority);

		this.infestors = _.map(this.creeps(InfestorSetup.role), creep => new ControllerAttackerZerg(creep));
		this.attackPositions = this.getAttackPositions();
		this.readyTick = this.getReadyTick();
		this.spawnGroup = new SpawnGroup(directive.pos.roomName, { requiredRCL: 4 });
		this.directiveMemory = directive.memory;
	}

	init() {
		// TODO: Prespawn attackers to arrive as cooldown disappears
		if (this.attackPositions.length > 0 && Game.time >= this.readyTick) {
			this.wishlist(this.attackPositions.length, InfestorSetup);
			// TODO: hack to get the SpawnGroup to initialize until it's fixed in Overmind.ts
			if (this.spawnGroup) {
				this.spawnGroup.init();
			}
		}

		if (this.attackPositions.length > 0 && this.infestors.length > 0 && _.some(this.infestors, infestor => !infestor.memory.attackPosition)) {
			let i = 0;
			for (let position of this.attackPositions) {
				let infestor = this.infestors[i % this.infestors.length];
				infestor.memory.attackPosition = position;
				i++;
			}	
		}
	}

	run() {
		for (let infestor of this.infestors) {
			//if (!infestor.memory.attackPosition) {
			//	infestor.memory.attackPosition = _.filter(this.attackPositions, pos => !_.find(this.infestors, otherInfestor => otherInfestor.memory.attackPosition ? derefRoomPosition(otherInfestor.memory.attackPosition).isEqualTo(pos) : false))[0];
			//	if (!infestor.memory.attackPosition) {
			//		log.error("Could not find attackPosition for controller attacker!")
			//	}
			//}
			this.handleInfestor(infestor);
			if (this.room && this.room.controller) {
				if (!this.room.controller.upgradeBlocked) {
					if (infestor.ticksToLive && infestor.ticksToLive <= 2 && infestor.pos.isNearTo(this.room.controller)) {
						this.launchAttack();
					} else if (this.attackPositions.length > 0 && _.filter(this.infestors, infestor => infestor.pos.isNearTo(this.room!.controller!)).length == this.attackPositions.length) {
						this.launchAttack();
					}
				} else {
					//if (this.room.controller.upgradeBlocked && infestor.ticksToLive && infestor.ticksToLive <= this.room.controller.upgradeBlocked + 2) {
					//	delete infestor.memory;
					//	infestor.suicide();
					//}
				}
			}
		}
	}

	private handleInfestor(infestor: ControllerAttackerZerg): void {
		// TODO: handle if room has hostiles
		infestor.goTo(derefRoomPosition(infestor.memory.attackPosition));
	}

	private launchAttack(): void {
		if (this.room && this.room.controller) {
			for (let infestor of this.infestors) {
				if (infestor.pos.isNearTo(this.room.controller)) {
					infestor.attackController(this.room.controller);
				}
			}
		}
	}

	private getReadyTick(): number {
		if (!this.directiveMemory.readyTick || this.directiveMemory.readyTick < Game.time) {
			if (this.room && this.room.controller && this.room.controller.upgradeBlocked) {
				this.directiveMemory.readyTick = Game.time + this.room.controller.upgradeBlocked;
				return this.directiveMemory.readyTick;
			} else {
				if (this.directiveMemory.readyTick) delete this.directiveMemory.readyTick;
				return Game.time;
			}
		} else {
			return this.directiveMemory.readyTick;
		}
	}

	private getAttackPositions(): RoomPosition[]{
		if (this.directiveMemory.attackPositions) {
			let attackPositions = _.map(this.directiveMemory.attackPositions, protoPos => derefRoomPosition(protoPos));
			if (_.some(attackPositions, pos => !pos.isWalkable(true))) {
				delete this.directiveMemory.attackPositions;
			} else {
				return attackPositions;
			}
		} else {
			if (this && this.room && this.room.controller) {
				let attackPositions = this.room.controller.pos.availableNeighbors(true);
				this.directiveMemory.attackPositions = attackPositions;
				return attackPositions;
			}
		}
		return [];
		//log.error("No attack positions reported for controller attack.");
	}
}

export class ControllerAttackerZerg extends Zerg {
	memory: ControllerAttackerMemory;
}