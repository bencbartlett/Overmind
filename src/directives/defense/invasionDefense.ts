import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {RangedDefenseOverlord} from '../../overlords/defense/rangedDefense';
import {ColonyStage} from '../../Colony';
import {CombatIntel} from '../../intel/CombatIntel';
import {MeleeDefenseOverlord} from '../../overlords/defense/meleeDefense';
import {NotifierPriority} from '../Notifier';

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

	private relocateFrequency: number;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 1 && colony.spawns.length > 0);
	}

	spawnMoarOverlords() {

		if (!this.room) {
			return;
		}
		let expectedDamage = CombatIntel.maxDamageByCreeps(this.room.dangerousHostiles);
		let useBoosts = (expectedDamage > ATTACK_POWER * 75)
						&& !!this.colony.terminal
						&& !!this.colony.evolutionChamber;
		let percentWalls = _.filter(this.room.barriers, s => s.structureType == STRUCTURE_WALL).length /
						   this.room.barriers.length;
		let meleeHostiles = _.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(ATTACK) > 0 ||
																	hostile.getActiveBodyparts(WORK) > 0);
		let rangedHostiles = _.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(RANGED_ATTACK) > 0);
		if (this.colony.stage > ColonyStage.Larva) {
			this.overlords.rangedDefense = new RangedDefenseOverlord(this, useBoosts);
		} else {
			this.overlords.meleeDefense = new MeleeDefenseOverlord(this, useBoosts);
		}

	}

	init(): void {
		let numHostiles: string = this.room ? this.room.hostiles.length.toString() : '???';
		this.alert(`Invasion (hostiles: ${numHostiles})`, NotifierPriority.Critical);
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
