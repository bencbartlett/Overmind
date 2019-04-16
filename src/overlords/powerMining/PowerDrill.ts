import {CombatZerg} from '../../zerg/CombatZerg';
import {DirectiveSKOutpost} from '../../directives/colony/outpostSK';
import {RoomIntel} from '../../intel/RoomIntel';
import {minBy} from '../../utilities/utils';
import {Mem} from '../../memory/Memory';
import {debug, log} from '../../console/log';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {Visualizer} from '../../visuals/Visualizer';
import {profile} from '../../profiler/decorator';
import {CombatOverlord} from '../CombatOverlord';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {OverlordMemory} from '../Overlord';
import {DirectivePowerMine} from "../../directives/resource/powerMine";

interface PowerDrillOverlordMemory extends OverlordMemory {
	targetPBID?: string;
}

/**
 * PowerDrillOverlord -- spawns drills and coolant to mine power banks
 */
@profile
export class PowerDrillOverlord extends CombatOverlord {

	static requiredRCL = 7;

	directive: DirectiveSKOutpost;
	memory: PowerDrillOverlordMemory;
	targetPowerBank: StructurePowerBank | undefined;

	drills: CombatZerg[];
	coolant: CombatZerg[];

	constructor(directive: DirectivePowerMine, priority = OverlordPriority.powerMine.drill) {
		super(directive, 'powerDrill', priority, PowerDrillOverlord.requiredRCL);
		this.directive = directive;
		this.priority += this.outpostIndex * OverlordPriority.powerMine.roomIncrement;
		this.drills = this.combatZerg(Roles.drill);
		this.coolant = this.combatZerg(Roles.coolant);
		this.memory = Mem.wrap(this.directive.memory, 'powerDrill');
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, 'powerDrill');
	}

	init() {
		this.wishlist(2, CombatSetups.coolant.default);
		this.wishlist(1, CombatSetups.drill.default);
	}

	private handleDrill(drill: CombatZerg) {

		// Go to keeper room
		if (!this.room || drill.room != this.room || drill.pos.isEdge) {
			// log.debugCreep(reaper, `Going to room!`);
			//drill.healSelfIfPossible();
			Game.notify("Drill is moving to power site in " + this.room + ".");
			drill.goTo(this.pos);
			return;
		} else if (!this.targetPowerBank) {
			// If power bank is dead
			Game.notify("Power bank in " + this.room + " is dead.");
			return;
		} else if (this.targetPowerBank.hits < 50000) {
			Game.notify("Power bank in " + this.room + " is almost dead");
			// Spawn a hauler for this location
			// Should make a 49 carry 1 move creep to hold some, and a bunch of creeps to pick up ground first then container creep
		}

		//  Handle killing bank
		if (drill.hits > 100) {
			drill.attack(this.targetPowerBank);
		}
	}

	private handleCoolant(coolant: CombatZerg) {

		// Go to keeper room
		if (!this.room || coolant.room != this.room || coolant.pos.isEdge) {
			// log.debugCreep(reaper, `Going to room!`);
			coolant.healSelfIfPossible();
			coolant.goTo(this.pos);
			return;
		} else if (!this.targetPowerBank) {
			// If power bank is dead
			Game.notify("Power bank in " + this.room + " is dead.");
			return;
		} else if (this.targetPowerBank.hits < 50000) {
			Game.notify("Power bank in " + this.room + " is almost dead");
		}

		coolant.autoHeal();
	}

	run() {
		this.autoRun(this.drills, drill => this.handleDrill(drill));
		this.autoRun(this.coolant, coolant => this.handleCoolant(coolant));
	}

	visuals() {
		if (this.room && this.targetPowerBank) {
			Visualizer.marker(this.targetPowerBank.pos);
		}
	}

}
