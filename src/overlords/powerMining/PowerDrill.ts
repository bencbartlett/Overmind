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
import {DirectiveHaul} from "../../directives/resource/haul";

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
		this.wishlist(3, CombatSetups.drill.default);
		this.wishlist(4, CombatSetups.coolant.default);
	}

	private handleDrill(drill: CombatZerg) {
		if (!this.targetPowerBank) {
			if (!this.room) {
				// We are not there yet
			} else {
				var bank = this.pos.lookForStructure(STRUCTURE_POWER_BANK) as StructurePowerBank;
				this.targetPowerBank = bank;
				// If power bank is dead
				if (bank == undefined) {
					Game.notify("Power bank in " + this.room + " is dead.");
					DirectiveHaul.create(this.pos);
					this.directive.remove();
					Game.notify("FINISHED POWER MININING IN " + this.room + " DELETING CREEP at time: " + Game.time.toString());
					drill.suicide();
					return;
				}
			}
		}

		// Go to keeper room
		if (!this.room || drill.room != this.room || drill.pos.isEdge || !this.targetPowerBank) {
			// log.debugCreep(drill, `Going to room!`);
			Game.notify("Drill is moving to power site in " + this.room + ".");
			drill.goTo(this.pos);
			return;
		} else if (this.targetPowerBank.hits < 50000) {
			Game.notify("Power bank in " + this.room + " is almost dead");
			// Spawn a hauler for this location
			// Should make a 49 carry 1 move creep to hold some, and a bunch of creeps to pick up ground first then container creep
		}

		//  Handle killing bank
		if (drill.hits > 100) {
			drill.goTo(this.targetPowerBank);
			drill.attack(this.targetPowerBank);
		}
	}

	private handleCoolant(coolant: CombatZerg) {
		// Go to powerbank room
		if (!this.room || coolant.room != this.room || coolant.pos.isEdge) {
			// log.debugCreep(reaper, `Going to room!`);
			coolant.healSelfIfPossible();
			coolant.goTo(this.pos);
			return;
		} else if (!this.targetPowerBank) {
			// If power bank is dead
			Game.notify("Power bank in " + this.room + " is dead.");
			coolant.suicide();
			return;
		} else if (this.targetPowerBank.hits < 50000) {
			Game.notify("Power bank in " + this.room + " is almost dead");
			Game.notify("Power bank in " + this.room + ", beginning haul operation.");
			//DirectiveHaul.create(this.pos);
		}
		if (coolant.pos.getRangeTo(_.first(this.drills)) > 1) {
			coolant.goTo(_.first(this.drills));
		}

		coolant.autoHeal(false);
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
