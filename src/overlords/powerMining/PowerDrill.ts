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
import {calculateFormationStrength} from "../../utilities/creepUtils";

interface PowerDrillOverlordMemory extends OverlordMemory {
	targetPBID?: string;
}

/**
 * PowerDrillOverlord -- spawns drills and coolant to mine power banks
 */
@profile
export class PowerDrillOverlord extends CombatOverlord {

	static requiredRCL = 7;

	directive: DirectivePowerMine;
	memory: PowerDrillOverlordMemory;
	targetPowerBank: StructurePowerBank | undefined;
	haulDirectiveCreated: boolean;

	drills: CombatZerg[];
	coolant: CombatZerg[];

	constructor(directive: DirectivePowerMine, priority = OverlordPriority.powerMine.drill) {
		super(directive, 'powerDrill', priority, PowerDrillOverlord.requiredRCL);
		this.directive = directive;
		this.priority += this.outpostIndex * OverlordPriority.powerMine.roomIncrement;
		this.drills = this.combatZerg(Roles.drill);
		this.coolant = this.combatZerg(Roles.coolant);
		this.memory = Mem.wrap(this.directive.memory, 'powerDrill');
		this.haulDirectiveCreated = false;
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, 'powerDrill');

	}

	init() {
		this.wishlist(3, CombatSetups.drill.default);
		this.wishlist(4, CombatSetups.coolant.default);
	}

	private getHostileDrill(powerBank: StructurePowerBank) {
		return powerBank.hits < powerBank.hitsMax && powerBank.pos.findInRange(FIND_HOSTILE_CREEPS, 2)[0];
	}

	private handleHostileDrill(hostileDrill: Creep, powerBank: StructurePowerBank) {
		Game.notify(`${hostileDrill.owner.username} power harvesting ${powerBank.room.name}, competing for same power bank.`);
		// this.directive.remove();
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
					this.directive.remove();
					Game.notify("FINISHED POWER MINING IN " + this.room + " DELETING CREEP at time: " + Game.time.toString());
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
		} else if (this.targetPowerBank.hits < 800000 && !this.haulDirectiveCreated) {
			Game.notify("Power bank in " + this.room + " is almost dead");
			Game.notify("Power bank in " + this.room + ", beginning haul operation.");
			//this.haulDirectiveCreated = typeof DirectiveHaul.create(this.pos) == "string";
		}
		// Spawn a hauler for this location
		// Should make a 49 carry 1 move creep to hold some, and a bunch of creeps to pick up ground first then container creep

		//  Handle killing bank
		if (drill.pos.isNearTo(this.targetPowerBank)) {
			drill.attack(this.targetPowerBank);
		} else {
			drill.goTo(this.targetPowerBank);
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
		}

		if (coolant.memory.partner) {
			let drill = Game.creeps[coolant.memory.partner];
			if (!drill) {
				coolant.memory.partner = undefined;
			} else if (!coolant.pos.isNearTo(drill)) {
				coolant.goTo(drill);
			} else {
				coolant.heal(drill);
			}
		}
		if (coolant.pos.getRangeTo(this.targetPowerBank) > 2) {
			coolant.goTo(this.targetPowerBank);
		}

		coolant.autoHeal(false);
	}

	private findDrillToPartner(coolant: CombatZerg) {

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
