import {log} from '../../console/log';
import {CombatSetups, Roles} from '../../creepSetups/setups';
import {DirectivePowerMine} from '../../directives/resource/powerMine';
import {Mem} from '../../memory/Memory';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {CombatZerg} from '../../zerg/CombatZerg';
import {Zerg} from '../../zerg/Zerg';
import {CombatOverlord, CombatOverlordMemory} from '../CombatOverlord';

interface PowerDrillOverlordMemory extends CombatOverlordMemory {
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
	partnerMap: Map<string, string[]>;

	drills: CombatZerg[];
	coolant: CombatZerg[];

	constructor(directive: DirectivePowerMine, priority = OverlordPriority.powerMine.drill) {
		super(directive, 'powerDrill', priority, PowerDrillOverlord.requiredRCL);
		this.directive = directive;
		this.priority += this.outpostIndex * OverlordPriority.powerMine.roomIncrement;
		this.drills = this.combatZerg(Roles.drill);
		this.coolant = this.combatZerg(Roles.coolant);
		this.memory = Mem.wrap(this.directive.memory, 'powerDrill');
		this.partnerMap = new Map();
	}

	refresh() {
		super.refresh();
		this.memory = Mem.wrap(this.directive.memory, 'powerDrill');
	}

	init() {
		this.wishlist(1, CombatSetups.drill.default);
		this.wishlist(2, CombatSetups.coolant.small);
	}

	private getHostileDrill(powerBank: StructurePowerBank) {
		return powerBank.hits < powerBank.hitsMax && powerBank.pos.findInRange(FIND_HOSTILE_CREEPS, 2)[0];
	}

	private handleHostileDrill(hostileDrill: Creep, powerBank: StructurePowerBank) {
		Game.notify(`${hostileDrill.owner.username} power harvesting ${powerBank.room.name}, competing for same power bank.`);
		// this.directive.remove();
	}

	private handleDrill(drill: CombatZerg) {
		if (drill.spawning) {
			return;
		}
		if (!this.directive.powerBank) {
			if (!this.room) {
				// We are not there yet
			} else {
				// If power bank is dead
				if (this.directive.powerBank == undefined && this.directive.memory.state < 2) {
					Game.notify(`Power bank in ${this.room.print} is dead.`);
					drill.say('💀 RIP 💀');
					const result = drill.retire();
					if (result == ERR_BUSY) {
						// drill spawning, find something else to do with them
					}
					log.notify('FINISHED POWER MINING IN ' + this.room + ' DELETING CREEP at time: ' +
							   Game.time.toString() + ' result: ' + result);
					return;
				}
			}
		}

		// Go to power room
		if (!this.room || drill.room != this.room || drill.pos.isEdge || !this.directive.powerBank) {
			// log.debugCreep(drill, `Going to room!`);
			// log.notify("Drill is moving to power site in " + this.pos.roomName + ".");
			drill.goTo(this.pos);
			return;
		}

		//  Handle killing bank
		if (drill.pos.isNearTo(this.directive.powerBank)) {
			if (!this.partnerMap.get(drill.name)) {
				this.partnerMap.set(drill.name, []);
			}
			PowerDrillOverlord.periodicSay(drill, 'Drilling⚒️');
			drill.attack(this.directive.powerBank);
		} else {
			PowerDrillOverlord.periodicSay(drill, '🚗Traveling🚗');
			drill.goTo(this.directive.powerBank);
		}
	}

	private handleCoolant(coolant: CombatZerg) {
		if (coolant.spawning) {
			return;
		}
		// Go to powerbank room
		if (!this.room || coolant.room != this.room || coolant.pos.isEdge) {
			// log.debugCreep(coolant, `Going to room!`);
			coolant.healSelfIfPossible();
			coolant.goTo(this.pos);
			return;
		} else if (!this.directive.powerBank) {
			// If power bank is dead
			Game.notify('Power bank in ' + this.room + ' is dead.');
			coolant.say('💀 RIP 💀');
			coolant.retire();
			return;
		}
		if (coolant.pos.getRangeTo(this.directive.powerBank) > 3) {
			coolant.goTo(this.directive.powerBank);
		} else {
			const activeDrills = this.pos.findInRange(FIND_MY_CREEPS, 1).filter(creep => _.contains(creep.name, 'drill'));
			if (activeDrills.length > 0) {
				const drill = activeDrills[0];
				coolant.heal(drill);
				if (coolant.pos.getRangeTo(drill) > 1) {
					coolant.goTo(drill, {range: 1, noPush: true});
				}
			}
		}


		// else if (coolant.pos.findInRange(FIND_MY_CREEPS, 1).filter(creep => _.contains(creep.name, "drill")).length == 0) {
		// 	let target = _.sample(_.filter(this.drills, drill => drill.hits < drill.hitsMax));
		// 	if (target) {
		// 		coolant.goTo(target, {range: 1, noPush: true});
		// 	}
		// }
		// // else if (coolant.pos.getRangeTo(this.directive.powerBank) == 1) {
		// // 	coolant.move(Math.round(Math.random()*7) as DirectionConstant);
		// // }
		// else {
		// 	let drill = _.sample(_.filter(this.drills, drill => drill.hits < drill.hitsMax));
		// 	if (drill) { coolant.goTo(drill); }
		// }
		//
		// coolant.autoHeal();
	}

	// private findDrillToPartner(coolant: CombatZerg) {
	// 	let needsHealing = _.min(Array.from(this.partnerMap.keys()), key => this.partnerMap.get(key)!.length);
	// 	if (this.partnerMap.get(needsHealing)) {
	// 		this.partnerMap.get(needsHealing)!.concat(coolant.name);
	// 		coolant.say(needsHealing.toString());
	// 		coolant.memory.partner = needsHealing;
	// 	} else {
	//
	// 	}
	// 	//console.log(JSON.stringify(this.partnerMap));
	// 	// let newPartner = _.sample(_.filter(this.drills, drill => this.room == drill.room));
	// 	// coolant.memory.partner = newPartner != undefined ? newPartner.name : undefined;
	// 	coolant.say('Partnering!');
	// }
	//
	// private runPartnerHealing(coolant: CombatZerg) {
	// 	if (coolant.memory.partner) {
	// 		let drill = Game.creeps[coolant.memory.partner];
	// 		if (!drill) {
	// 			// Partner is dead
	// 			coolant.memory.partner = undefined;
	// 			this.findDrillToPartner(coolant)
	// 		} else if (!coolant.pos.isNearTo(drill)) {
	// 			PowerDrillOverlord.periodicSay(coolant,'🚗Traveling️');
	// 			coolant.goTo(drill);
	// 		} else {
	// 			PowerDrillOverlord.periodicSay(coolant,'❄️Cooling❄️');
	// 			coolant.heal(drill);
	// 		}
	// 		if (Game.time % 10 == PowerDrillOverlord.getCreepNameOffset(coolant)) {
	// 			this.findDrillToPartner(coolant);
	// 		}
	// 		return;
	// 	} else {
	// 		this.findDrillToPartner(coolant);
	// 	}
	// }

	static periodicSay(zerg: Zerg, text: string) {
		if (Game.time % 10 == PowerDrillOverlord.getCreepNameOffset(zerg)) {
			zerg.say(text, true);
		}
	}

	static getCreepNameOffset(zerg: Zerg) {
		return parseInt(zerg.name.charAt(zerg.name.length - 1), 10) || 0;
	}

	run() {
		this.autoRun(this.drills, drill => this.handleDrill(drill));
		this.autoRun(this.coolant, coolant => this.handleCoolant(coolant));
		if (this.directive.memory.state >= 3) {
			Game.notify('DELETING ALL POWER MINING CREEPS BECAUSE STATE IS >= 3 in ' + this.directive.print);
			this.drills.forEach(drill => drill.retire());
			this.coolant.forEach(coolant => coolant.retire());
		}
	}

	visuals() {
		if (this.room && this.directive.powerBank) {
			Visualizer.marker(this.directive.powerBank.pos);
		}
	}

}
