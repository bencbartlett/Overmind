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
import {Zerg} from "../../zerg/Zerg";

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

	partnerMap: Map<string, string[]>;
	isDone: boolean;

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
		this.partnerMap = new Map();
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, 'powerDrill');

	}

	init() {
		this.wishlist(1, CombatSetups.drill.default);
		this.wishlist(2, CombatSetups.coolant.default);
		this.wishlist(1, CombatSetups.drill.default);
		this.wishlist(2, CombatSetups.coolant.default);
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
				// If power bank is dead
				if (this.targetPowerBank == undefined) {
					this.targetPowerBank = this.pos.lookForStructure(STRUCTURE_POWER_BANK) as StructurePowerBank;
					if (this.targetPowerBank) {
						return;
					}
					if (this.pos.lookFor(LOOK_RESOURCES).length == 0) {
					// Well shit, we didn't finish mining
					Game.notify("WE FUCKING FAILED. SORRY CHIEF, COULDN'T FINISHED POWER MINING IN " + this.room + " DELETING CREEP at time: " + Game.time.toString());
					this.directive.remove();
					return;
				}
					Game.notify("Power bank in " + this.room + " is dead.");
					//this.directive.remove();
					Game.notify("FINISHED POWER MINING IN " + this.room + " DELETING CREEP at time: " + Game.time.toString());
					drill.say('💀 RIP 💀');
					this.isDone = true;
					drill.suicide();
					return;
				}
			}
		}

		// Go to power room
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
			if (!this.partnerMap.get(drill.name)) {
				this.partnerMap.set(drill.name, []);
			}
			PowerDrillOverlord.periodicSay(drill,'Drilling⚒️');
			drill.attack(this.targetPowerBank);
		} else {
			PowerDrillOverlord.periodicSay(drill,'🚗Traveling🚗');
			drill.goTo(this.targetPowerBank);
		}
	}

	private handleCoolant(coolant: CombatZerg) {
		// Go to powerbank room
		if (!this.room || coolant.room != this.room || coolant.pos.isEdge) {
			// log.debugCreep(coolant, `Going to room!`);
			coolant.healSelfIfPossible();
			coolant.goTo(this.pos);
			return;
		} else if (!this.targetPowerBank) {
			// If power bank is dead
			Game.notify("Power bank in " + this.room + " is dead.");
			coolant.say('💀 RIP 💀');
			this.isDone = true;
			coolant.suicide();
			return;
		}

		if (coolant.memory.partner) {
			let drill = Game.creeps[coolant.memory.partner];
			if (!drill) {
				// Partner is dead
				coolant.memory.partner = undefined;
				this.findDrillToPartner(coolant)
			} else if (!coolant.pos.isNearTo(drill)) {
				PowerDrillOverlord.periodicSay(coolant,'🚗Traveling️');
				coolant.goTo(drill);
			} else {
				PowerDrillOverlord.periodicSay(coolant,'❄️Cooling❄️');
				coolant.heal(drill);
			}
			if (Game.time % 10 == PowerDrillOverlord.getCreepNameOffset(coolant)) {
				this.findDrillToPartner(coolant);
			}
			return;
		} else {
			this.findDrillToPartner(coolant);
		}
		if (coolant.pos.getRangeTo(this.targetPowerBank) > 2) {
			coolant.goTo(this.targetPowerBank);
		} else if (coolant.pos.getRangeTo(this.targetPowerBank) == 1) {
			coolant.flee([this.targetPowerBank.pos]);
		} else {
			coolant.goTo(_.sample(_.filter(this.drills, drill => drill.hits < drill.hitsMax)));
		}

		coolant.autoHeal();
	}

	private findDrillToPartner(coolant: CombatZerg) {
		let needsHealing = _.min(Array.from(this.partnerMap.keys()), key => this.partnerMap.get(key)!.length);
		if (this.partnerMap.get(needsHealing)) {
			this.partnerMap.get(needsHealing)!.concat(coolant.name);
			coolant.say(needsHealing.toString());
			coolant.memory.partner = needsHealing;
		} else {

		}
		//console.log(JSON.stringify(this.partnerMap));
		// let newPartner = _.sample(_.filter(this.drills, drill => this.room == drill.room));
		// coolant.memory.partner = newPartner != undefined ? newPartner.name : undefined;
		coolant.say('Partnering!');
	}

	static periodicSay(zerg: CombatZerg, text: string) {
		if (Game.time % 10 == PowerDrillOverlord.getCreepNameOffset(zerg)) {
			zerg.say(text, true);
		}
	}

	static getCreepNameOffset(creep: Zerg) {
		return parseInt(creep.name.charAt(creep.name.length-1)) || 0;
	}

	run() {
		this.autoRun(this.drills, drill => this.handleDrill(drill));
		this.autoRun(this.coolant, coolant => this.handleCoolant(coolant));
		if (this.isDone) {
			this.directive.setMiningDone(this.name);
		}
	}

	visuals() {
		if (this.room && this.targetPowerBank) {
			Visualizer.marker(this.targetPowerBank.pos);
		}
	}

}
