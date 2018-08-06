// import {Task} from '../Task';
// import {profile} from '../../profiler/decorator';
//
// export type fleeTargetType = { pos: RoomPosition } | RoomPosition;
// export const fleeTaskName = 'flee';
//
// // Flee task makes creep move to a fallback position and wait until a specified room is safe
//
// @profile
// export class TaskFlee extends Task {
//
// 	target: null;
//
// 	data: {
// 		fleeFromRoom: string;
// 	};
//
// 	constructor(fallback: fleeTargetType, options = {} as TaskOptions) {
// 		if (fallback instanceof RoomPosition) {
// 			super(fleeTaskName, {ref: '', pos: fallback}, options);
// 		} else {
// 			super(fleeTaskName, {ref: '', pos: fallback.pos}, options);
// 		}
// 		// Settings
// 		this.settings.targetRange = 4;
// 		// Options
// 		// this.options.moveOptions = {
// 		// 	// allowHostile: true,
// 		// 	allowSK     : true,
// 		// };
// 	}
//
// 	isValidTask() {
// 		// Task is valid while fleeFromRoom is not visibly safe
// 		let fleeFromRoom = Game.rooms[this.data.fleeFromRoom] as Room | undefined;
// 		let roomIsSafe = (fleeFromRoom && fleeFromRoom.hostiles.length == 0);
// 		return !roomIsSafe;
// 	}
//
// 	isValidTarget() {
// 		return true;
// 	}
//
// 	isValid(): boolean {
// 		let validTask = false;
// 		if (this.creep) {
// 			validTask = this.isValidTask();
// 		}
// 		// Return if the task is valid; if not, finalize/delete the task and return false
// 		if (validTask) {
// 			return true;
// 		} else {
// 			// Switch to parent task if there is one
// 			let isValid = false;
// 			if (this.parent) {
// 				isValid = this.parent.isValid();
// 			}
// 			this.finish();
// 			return isValid;
// 		}
// 	}
//
// 	run(): number | undefined {
// 		// Log the fleeFrom room if you don't have one already
// 		if (!this.data.fleeFromRoom && this.creep) {
// 			let proto = this.proto;
// 			proto.data.fleeFromRoom = this.creep.room.name;
// 			this.proto = proto;
// 		}
// 		// If creep is in an unsafe room, retreat until you are in range of fallbackPos
// 		if (this.creep.room.hostiles) {
// 			// If you're within range of the fallback position, park
// 			if (this.creep.pos.inRangeTo(this.targetPos, this.settings.targetRange) && !this.creep.pos.isEdge) {
// 				return this.creep.park(this.targetPos);
// 			} else {
// 				return this.moveToTarget();
// 			}
// 		}
// 		// If creep is in a safe room, retreat until you are sufficiently far from edge
// 		else {
// 			// Park if far away from edge
// 			if (this.creep.pos.rangeToEdge > 3) {
// 				return this.creep.park(this.targetPos);
// 			} else {
// 				return this.moveToTarget();
// 			}
// 		}
// 	}
//
// 	work() {
// 		return OK;
// 	}
//
// }
