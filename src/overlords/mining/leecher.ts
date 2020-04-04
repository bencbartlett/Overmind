import { DirectiveLeech } from 'directives/resource/leech';
import { transferAllTargetType } from 'tasks/instances/transferAll';
import {bodyCost, CreepSetup} from '../../creepSetups/CreepSetup';
import {Roles, Setups} from '../../creepSetups/setups';
import {CombatIntel} from '../../intel/CombatIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';
import {OverlordMemory} from '../Overlord';

/**
 * Sends out a stationary scout, which travels to a waypoint and remains there indefinitely
 */
interface LeechOverlordMemory extends OverlordMemory {
	leechTimer: number;
}
@profile
export class LeecherOverlord extends Overlord {

	directive: DirectiveLeech;
	leechers: Zerg[];
	memory: LeechOverlordMemory;

	
	constructor(directive: DirectiveLeech, priority = OverlordPriority.default) {
		super(directive, 'leech', priority);
		this.directive = directive;
		this.leechers = this.zerg(Roles.transport, {notifyWhenAttacked: false});
	}

	refresh() {
		super.refresh();
	}

	init() {
		this.wishlist(1, Setups.transporters.early);
	}

	run() {
		this.updateTotalCreepCost();
		this.autoRun(this.leechers, leacher => this.handleLeecher(leacher));
	}

	private updateTotalCreepCost() {
		// note: do not execute in handleLeecher after autoRun
		// autoRun does not execute if there is a TASK already running
		// so run it inside run() instead 
		_.forEach(this.leechers, leecher => {
			if (leecher.ticksToLive == 1500) {
				this.directive.memory.totalCost += bodyCost(_.map(leecher.body, part => part.type));
			}
		});
	}

	private handleLeecher(leecher: Zerg) {
		// heal @colony room if damaged.
		if(leecher.hits < leecher.hitsMax) {
			this.memory.leechTimer = Game.time + 300;
			leecher.goTo(this.colony);
			return;
		}
		// carry == 0 => Leech
		if(leecher.carry.energy == 0) {
			if(this.updateLeechTimer(leecher) ||// Go to target room and set leech timer
			   this.fallBack(leecher) || 		// fallback if timer on
			   this.leech(leecher)) { 			// Leech if time is due
			}
		} 
		// carry > 0 => transfer loot to storage
		else {
			this.transferBack(leecher);
		}
	}

	private updateLeechTimer(leecher: Zerg): boolean {
		if (!this.memory.leechTimer) {
			if (leecher.inSameRoomAs(this) && !leecher.pos.isEdge) {
				
				// if there are dangerous creep, then fallback for 100 ticks
				// if((// leecher.room.dangerousHostiles.length > 0 ||
				//  leecher.room.invaders.length) > 0) {
				// 	this.memory.leechTimer = Game.time + 100;
				// if containers are not full, then wait for x
				// } else 
				if(leecher.room.containers.length > 0) {
					const presentEnergy = _.sum(_.map(leecher.room.containers, cont => cont.store.energy));
					if(presentEnergy >= leecher.carryCapacity) {
						this.memory.leechTimer = Game.time; // now
					} else {
						this.memory.leechTimer = Game.time + 
						((leecher.carryCapacity - presentEnergy)/(leecher.room.containers.length*2*10));
					}
				} else { // if there are no container, then wait 100
					this.memory.leechTimer = Game.time + 100;
				}
			}
			else {
				leecher.goTo(this);
			}
			return true;
		}
		return false;
	}
	private fallBack(leecher: Zerg): boolean {
		if (this.memory.leechTimer > Game.time) {
			leecher.goTo(CombatIntel.getFallbackFrom(this.pos));
			return true;
		}
		return false;
	}
	private leech(leecher: Zerg): boolean {
		if (this.memory.leechTimer <= Game.time) {
			if(!leecher.inSameRoomAs(this) && !leecher.pos.isEdge) {
				leecher.goTo(this);
			} else {
				if(leecher.room.containers.length == 1) {
					leecher.task = Tasks.withdraw(leecher.room.containers[0],RESOURCE_ENERGY);	
				} else if(leecher.room.containers.length == 2) {
					 if(leecher.room.containers[0] > leecher.room.containers[1]) {
						leecher.task = Tasks.chain([Tasks.withdraw(leecher.room.containers[0],RESOURCE_ENERGY),
												Tasks.withdraw(leecher.room.containers[1], RESOURCE_ENERGY)]);
					 } else {
						leecher.task = Tasks.chain([Tasks.withdraw(leecher.room.containers[1],RESOURCE_ENERGY),
												Tasks.withdraw(leecher.room.containers[0], RESOURCE_ENERGY)]);
					 }
				} else {
					// will fallback waiting for container to be built in updateLeechTimer
				}
				this.memory.leechTimer  = 0;
			}
			
			return true;
		}
		return false;
	}
	private transferBack(leecher: Zerg) {
		if (leecher.inSameRoomAs(this.colony) && !leecher.pos.isEdge) {
			this.directive.memory.totalLeech += leecher.carry.energy;
			if (this.colony.storage || this.colony.terminal) {
				leecher.task = Tasks.transferAll(<transferAllTargetType>(this.colony.storage || this.colony.terminal));
			}
			else {
				leecher.drop(RESOURCE_ENERGY);
			}
		}
		else {
			leecher.goTo(this.colony);
		}
	}
}
