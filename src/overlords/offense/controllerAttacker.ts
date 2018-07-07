// Controller attacker overlord.  Spawn CLAIM creeps to mass up on a controller and attack all at once

import {Zerg} from '../../zerg/_Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {Overlord} from '../Overlord';
import {DirectiveControllerAttack} from '../../directives/offense/controllerAttack';
import {CreepSetup} from '../CreepSetup';
import {profile} from '../../profiler/decorator';
import {Movement} from '../../movement/Movement';
import {Pathing} from '../../movement/Pathing';
import {Colony} from '../../Colony';
import {log} from '../../console/log';
import {SpawnGroup, SpawnGroupSettings} from 'logistics/SpawnGroup';

const ControllerAttacker = new CreepSetup('ctrlAttack', {
	pattern: [CLAIM, MOVE],
	sizeLimit: Infinity,
	ordered: true
});

interface ControllerAttackerMemory extends CreepMemory {
	attackPos: protoPos;
}

@profile
export class ControllerAttackerOverlord extends Overlord {

	attackers: ControllerAttackerZerg[];
	scouts: Zerg[];
	attackPos: RoomPosition[] | undefined;
	spawns: StructureSpawn[] | undefined;
	readyAtTick: number;

	currentThreshold: number;

	settings: {
		baseThreshold: number,
		ticksTilThresholdDecrease: number,
	};

	constructor(directive: DirectiveControllerAttack, priority = OverlordPriority.offense.controllerAttack) {
		super(directive, 'controllerAttack', priority);

		this.attackers = _.map(this.creeps(ControllerAttacker.role), creep => new ControllerAttackerZerg(creep));
		this.attackPos = directive.attackPos;
		this.readyAtTick = directive.readyAtTick;
		if (directive.roomName) {
			this.spawnGroup = new SpawnGroup(directive.roomName, { requiredRCL: 3 });
		}
	}

	init() {
		// TODO: Prespawn attackers to arrive as cooldown disappears
		if (this.attackPos && Game.time >= this.readyAtTick) {
			this.wishlist(this.attackPos.length, ControllerAttacker);
			// hack to get the SpawnGroup to initialize until it's fixed in Overmind.ts
			if (this.spawnGroup) {
				this.spawnGroup.init();
			}
		}
	}

	run() {
		if (this.attackers) {
			for (let attacker of this.attackers) {
				if (!attacker.memory.attackPos) {
					attacker.memory.attackPos = _.filter(this.attackPos!, pos => !_.find(this.attackers, otherAttacker => otherAttacker.memory.attackPos ? derefRoomPosition(otherAttacker.memory.attackPos).isEqualTo(pos) : false))[0];
					if (!attacker.memory.attackPos) {
						log.error("Could not find attackPos for controller attacker!")
					}
				}
				this.handleAttacker(attacker);
				if (this.room && this.room.controller) {
					if (!this.room.controller.upgradeBlocked) {
						if (attacker.ticksToLive && attacker.ticksToLive <= 2 && attacker.pos.isNearTo(this.room.controller)) {
							this.launchAttack();
						} else if (this.attackPos && _.filter(this.attackers, attacker => attacker.pos.isNearTo(this.room!.controller!)).length == this.attackPos.length) {
							this.launchAttack();
						}
					} else {
						if (this.room!.controller!.upgradeBlocked && attacker.ticksToLive && attacker.ticksToLive <= this.room!.controller!.upgradeBlocked + 2) {
							delete attacker.memory;
							attacker.suicide();
						}
					}
				}
			}
		}
	}

	private handleAttacker(attacker: ControllerAttackerZerg): void {
		// TODO: handle if room has hostiles
		attacker.goTo(derefRoomPosition(attacker.memory.attackPos));
	}

	private launchAttack(): void {
		if (this.room && this.room.controller) {
			for (let attacker of this.attackers) {
				if (attacker.pos.isNearTo(this.room.controller)) {
					attacker.attackController(this.room.controller);
				}
			}
		}
	}
}

export class ControllerAttackerZerg extends Zerg {
	memory: ControllerAttackerMemory;
}