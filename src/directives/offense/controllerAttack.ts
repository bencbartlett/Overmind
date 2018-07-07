import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {ScoutOverlord} from '../../overlords/core/scout';
import {ControllerAttackerOverlord} from '../../overlords/offense/controllerAttacker';
import {log} from '../../console/log';

interface DirectiveControllerAttackMemory extends FlagMemory {
	attackPos: protoPos[];
	roomName: string;
	readyAtTick: number;
}


@profile
export class DirectiveControllerAttack extends Directive {

	static directiveName = 'controllerAttack';
	static color = COLOR_RED;
	static secondaryColor = COLOR_YELLOW;

	memory: DirectiveControllerAttackMemory;

	constructor(flag: Flag) {
		super(flag);

		if (this.room) {
			if (!this.memory.roomName) {
				this.memory.roomName = this.room.name;
			}
		}

		// TODO: Not have a scout at all times
		this.overlords.scout = new ScoutOverlord(this);
		this.overlords.controllerAttack = new ControllerAttackerOverlord(this);
	}

	get readyAtTick(): number {
		if (!this.memory.readyAtTick || this.memory.readyAtTick < Game.time) {
			if (this.room && this.room.controller && this.room.controller.upgradeBlocked) {
				this.memory.readyAtTick = Game.time + this.room.controller.upgradeBlocked;
				return this.memory.readyAtTick;
			} else {
				if (this.memory.readyAtTick) delete this.memory.readyAtTick;
				return Game.time;
			}
		} else {
			return this.memory.readyAtTick;
		}
	}

	get roomName(): string {
		return this.memory.roomName;
	}

	get attackPos(): RoomPosition[] | undefined {
		if (this.memory.attackPos) {
			let attackPos = _.map(this.memory.attackPos, protoPos => derefRoomPosition(protoPos));
			if (_.some(attackPos, pos => !pos.isWalkable(true))) {
				delete this.memory.attackPos;
			} else {
				return attackPos;
			}
		} else {
			if (this && this.room && this.room.controller) {
				let attackPos = this.room.controller.pos.availableNeighbors(true);
				this.memory.attackPos = attackPos;
				return attackPos;
			}
		}
		//log.error("No attack positions reported for controller attack.");
	}

	init(): void {

	}

	run(): void {

	}
}

