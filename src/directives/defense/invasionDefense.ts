import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {RangedDefenseOverlord} from '../../overlords/defense/rangedDefense';
import {ColonyStage} from '../../Colony';
import {MeleeDefenseOverlord} from '../../overlords/defense/meleeDefense';
import {log} from '../../lib/logger/log';
import {CombatIntel} from '../../intel/combatIntel';

interface DirectiveInvasionDefenseMemory extends FlagMemory {
	persistent?: boolean;
	created: number;
	safeSince: number;
}

@profile
export class DirectiveInvasionDefense extends Directive {

	static directiveName = 'invasionDefense';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_RED;
	static requiredRCL = 3;

	memory: DirectiveInvasionDefenseMemory;
	room: Room | undefined;

	private relocateFrequency: number;

	constructor(flag: Flag) {
		super(flag, DirectiveInvasionDefense.requiredRCL);
		if (!this.room) {
			return;
		}
		let expectedDamage = CombatIntel.maxDamageByCreeps(this.room.dangerousHostiles);
		let useBoosts = (expectedDamage > ATTACK_POWER * 75);
		let percentWalls = _.filter(this.room.barriers, s => s.structureType == STRUCTURE_WALL).length /
						   this.room.barriers.length;
		let meleeHostiles = _.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(ATTACK) > 0 ||
																	hostile.getActiveBodyparts(WORK) > 0);
		let rangedHostiles = _.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(RANGED_ATTACK) > 0);
		if (this.colony.stage > ColonyStage.Larva && percentWalls > 0.5) {
			this.overlords.rangedDefense = new RangedDefenseOverlord(this, useBoosts);
		} else if (meleeHostiles.length > 0) {
			this.overlords.meleeDefense = new MeleeDefenseOverlord(this, useBoosts);
		} else if (Game.time % 10 == 0) {
			log.warning(`No invasion defense overlord!`);
		}
	}

	init(): void {

	}

	run(): void {
		if (!this.room || this.room.hostiles.length > 0) {
			this.memory.safeSince = Game.time;
		}
		// If there are no hostiles left in the room and everyone's healed, then remove the flag
		if (this.room && this.room.hostiles.length == 0 &&
			Game.time - this.memory.safeSince > 100 && this.room.hostileStructures.length == 0) {
			if (_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax).length == 0) {
				this.remove();
			}
		}
	}
}
