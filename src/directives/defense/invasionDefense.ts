import {ColonyStage} from '../../Colony';
import {CombatIntel} from '../../intel/CombatIntel';
import {MeleeDefenseOverlord} from '../../overlords/defense/meleeDefense';
import {RangedDefenseOverlord} from '../../overlords/defense/rangedDefense';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';
import {isCombatZerg, isZerg} from "../../declarations/typeGuards";
import {getOverlord, normalizeZerg, toCreep, Zerg} from "../../zerg/Zerg";
import {CombatZerg} from "../../zerg/CombatZerg";
import {isUndefined} from "util";

interface DirectiveInvasionDefenseMemory extends FlagMemory {
	persistent?: boolean;
	created: number;
	safeSince: number;
}

/**
 * Defend an owned room against an incoming player invasion
 */
@profile
export class DirectiveInvasionDefense extends Directive {

	static directiveName = 'invasionDefense';
	static color = COLOR_BLUE;
	static secondaryColor = COLOR_PURPLE;

	memory: DirectiveInvasionDefenseMemory;
	room: Room | undefined;

	safeEndTime: 800;
	safeSpawnHaltTime: 100;

	private relocateFrequency: number;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 1 && colony.spawns.length > 0);
	}

	spawnMoarOverlords() {
		if (!this.room) {
			return;
		}
		let expectedDamage = CombatIntel.maxDamageByCreeps(this.room.dangerousPlayerHostiles);
		console.log(`ATTACK POWER EXPECTED IS ${expectedDamage} in room ${this.room.print}, safe for ${Game.time - this.memory.safeSince}`);
		let useBoosts = (expectedDamage > ATTACK_POWER * 13)
						&& !!this.colony.terminal
						&& !!this.colony.evolutionChamber;
		const percentWalls = _.filter(this.room.barriers, s => s.structureType == STRUCTURE_WALL).length /
							 this.room.barriers.length;
		const meleeHostiles = _.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(ATTACK) > 0 ||
																	  hostile.getActiveBodyparts(WORK) > 0);
		const rangedHostiles = _.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(RANGED_ATTACK) > 0);
		if (this.colony.stage > ColonyStage.Larva) {
			this.overlords.rangedDefense = new RangedDefenseOverlord(this, useBoosts);
		} else {
			this.overlords.meleeDefense = new MeleeDefenseOverlord(this, useBoosts);
		}
	}

	init(): void {
		const numHostiles: string = this.room ? this.room.hostiles.length.toString() : '???';
		this.alert(`Invasion (hostiles: ${numHostiles})`, NotifierPriority.Critical);
	}

	run(): void {
		if (!this.room || this.room.hostiles.length > 0) {
			this.memory.safeSince = Game.time;
		}
		// If there are no hostiles left in the room and everyone's healed, then remove the flag
		if (this.room && this.room.hostiles.length == 0 &&
			(Game.time - this.memory.safeSince) > this.safeEndTime && this.room.hostileStructures.length == 0) {
			if (_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax).length == 0) {
				this.remove();
			}
		}
	}

}
