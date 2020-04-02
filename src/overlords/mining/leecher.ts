import { transferAllTargetType } from 'tasks/instances/transferAll';
import {Roles, Setups} from '../../creepSetups/setups';
import {Directive} from '../../directives/Directive';
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

	leechers: Zerg[];
	memory: LeechOverlordMemory;

	constructor(directive: Directive, priority = OverlordPriority.default) {
		super(directive, 'leech', priority);
		this.leechers = this.zerg(Roles.transport, {notifyWhenAttacked: false});
	}

	init() {
		this.wishlist(1, Setups.transporters.early);
	}

	run() {
		for (const leecher of this.leechers) {
			// heal @colony room if damaged.
			if(leecher.hits < leecher.hitsMax) {
				leecher.goTo(this.colony);
				continue;
			}

			// carry == 0 => Leech
			if(leecher.carry.energy == 0) {
				if(this.updateLeechTimer(leecher) || // update when to leech (if set to 0)
				   this.fallBack(leecher) ||		 // fallback until it is time
				   this.leech(leecher)) {			 // leech Action
					continue;
				}
			} 
			// carry > 0 => transfer loot to storage
			else {
				this.transferBack(leecher);
			}
		}
	}

	private transferBack(leecher: Zerg) {
		if (leecher.inSameRoomAs(this.colony)) {
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

	private leech(leecher: Zerg): boolean {
		if (this.memory.leechTimer >= Game.time) {
			if(!leecher.inSameRoomAs(this)) {
				leecher.goTo(this);
			} else {
				if(leecher.room.containers.length == 1) {
					leecher.withdraw(leecher.room.containers[0]);
				} else if(leecher.room.containers.length == 2) {
				Tasks.chain([Tasks.withdraw(leecher.room.containers[0],RESOURCE_ENERGY),
							 Tasks.transfer(leecher.room.containers[1], RESOURCE_ENERGY)]);
				} else {
					// will fallback waiting for container to be built
				}
				this.memory.leechTimer  = 0;
			}
			return true;
		}
		return false;
	}

	private fallBack(leecher: Zerg): boolean {
		if (this.memory.leechTimer < Game.time) {
			leecher.goTo(CombatIntel.getFallbackFrom(this.pos));
			return true;
		}
		return false;
	}

	private updateLeechTimer(leecher: Zerg): boolean {
		if (!this.memory.leechTimer) {
			if (leecher.inSameRoomAs(this)) {
				// if there are dangerous creep, then fallback for 100 ticks
				if(leecher.room.dangerousPlayerHostiles.length > 0 ||
				   leecher.room.invaders.length > 0) {
					this.memory.leechTimer = Game.time + 100;
				// if containers are not full, then wait for x
				} else if(leecher.room.containers.length > 0) {
					this.memory.leechTimer = Game.time +
											(leecher.carryCapacity -
											 _.sum(_.map(leecher.room.containers, cont => cont.store.energy)))/
											 (leecher.room.containers.length)*2*6;
											 return true;

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
}
