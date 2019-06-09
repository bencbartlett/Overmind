import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveOutpost} from '../../directives/colony/outpost';
import {RoomIntel} from '../../intel/RoomIntel';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {MY_USERNAME} from '../../~settings';
import {Overlord} from '../Overlord';

/**
 * Spawns reservers to reserve an outpost room
 */
@profile
export class ReservingOverlord extends Overlord {

	reservers: Zerg[];
	reserveBuffer: number;

	constructor(directive: DirectiveOutpost, priority = OverlordPriority.remoteRoom.reserve) {
		super(directive, 'reserve', priority);
		// Change priority to operate per-outpost
		this.priority += this.outpostIndex * OverlordPriority.remoteRoom.roomIncrement;
		this.reserveBuffer = 2000;
		this.reservers = this.zerg(Roles.claim);
	}

	init() {
		let amount = 0;
		if (this.room) {
			if (this.room.controller!.needsReserving(this.reserveBuffer)) {
				amount = 1;
			}
		} else if (RoomIntel.roomReservedBy(this.pos.roomName) == MY_USERNAME &&
				   RoomIntel.roomReservationRemaining(this.pos.roomName) < 1000) {
			amount = 1;
		}
		this.wishlist(amount, Setups.infestors.reserve);
	}

	private handleReserver(reserver: Zerg): void {
		if (reserver.room == this.room && !reserver.pos.isEdge) {
			// If reserver is in the room and not on exit tile
			if (!this.room.controller!.signedByMe) {
				// Takes care of an edge case where planned newbie zone signs prevents signing until room is reserved
				if (!this.room.my && this.room.controller!.signedByScreeps) {
					reserver.task = Tasks.reserve(this.room.controller!);
				} else {
					reserver.task = Tasks.signController(this.room.controller!);
				}
			} else {
				reserver.task = Tasks.reserve(this.room.controller!);
			}
		} else {
			// reserver.task = Tasks.goTo(this.pos);
			reserver.goTo(this.pos);
		}
	}

	run() {
		this.autoRun(this.reservers, reserver => this.handleReserver(reserver));
	}
}
