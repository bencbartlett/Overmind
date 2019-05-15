// import {Directive} from '../Directive';
// import {profile} from '../../profiler/decorator';
// import {SiegeOverlord} from '../../overlords/offense/siege';
// import {Pathing} from '../../movement/Pathing';
// import {DirectiveHealPoint} from './healPoint';
// import {log} from '../../console/log';
// import {Visualizer} from '../../visuals/Visualizer';
//
// interface DirectiveSiegeMemory extends FlagMemory {
// 	recoveryWaypoint: ProtoPos;
// }
//
// @profile
// export class DirectiveSiege extends Directive {
//
// 	static directiveName = 'siege';
// 	static color = COLOR_RED;
// 	static secondaryColor = COLOR_ORANGE;
//
// 	memory: DirectiveSiegeMemory;
//
// 	private recoveryFlag: Flag | undefined;
//
// 	constructor(flag: Flag) {
// 		super(flag);
// 		this.recoveryFlag = Game.flags[this.name + ':healPoint'];
// 	}
//
// 	spawnMoarOverlords() {
// 		this.overlords.siege = new SiegeOverlord(this);
// 	}
//
// 	get recoveryWaypoint(): RoomPosition {
// 		if (this.recoveryFlag) {
// 			return this.recoveryFlag.pos;
// 		} else {
// 			if (this.memory.recoveryWaypoint) {
// 				return derefRoomPosition(this.memory.recoveryWaypoint);
// 			} else {
// 				return this.pos.neighbors[0];
// 			}
// 		}
// 	}
//
// 	calculateWaypoint(): RoomPosition | undefined {
// 		// Calculate the recovery waypoint
// 		let startPos = this.colony.hatchery ? this.colony.hatchery.pos : this.colony.pos;
// 		let ret = Pathing.findPath(startPos, this.pos, {range: 50});
// 		if (!ret.incomplete) {
// 			let path = ret.path;
// 			// Place the waypoint flag three squares before the last position in the previous room
// 			let lastIndexInSafeRoom = _.findLastIndex(_.filter(path, pos => pos.roomName != this.pos.roomName));
// 			let waypoint = path[Math.max(lastIndexInSafeRoom - 3, 0)];
// 			return waypoint;
// 		} else {
// 			log.info(`Incomplete path; couldn't place recovery flag!`);
// 		}
// 	}
//
// 	placeRecoveryFlag(waypoint: RoomPosition): void {
// 		if (waypoint.isVisible) {
// 			DirectiveHealPoint.create(waypoint, {name: this.name + ':healPoint'});
// 			log.info(`Placed recovery flag for ${this.pos.print} at ${waypoint.print}`);
// 		}
// 	}
//
// 	init(): void {
// 		// Place a recovery flag as needed
// 		if (!this.memory.recoveryWaypoint) {
// 			this.memory.recoveryWaypoint = this.calculateWaypoint()!;
// 		}
// 		if (!this.recoveryFlag) {
// 			this.placeRecoveryFlag(this.recoveryWaypoint);
// 		}
// 		this.alert(`Siege directive active`);
// 	}
//
// 	run(): void {
// 		// If there are no hostiles left in the room then remove the flag and associated healpoint
// 		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
// 			log.notify(`Siege at ${this.pos.roomName} completed successfully.`);
// 			if (this.recoveryFlag) {
// 				this.recoveryFlag.remove();
// 			}
// 			this.remove();
// 		}
// 	}
//
// 	visuals(): void {
// 		Visualizer.marker(this.pos, {color: 'red'});
// 		if (!this.recoveryFlag) {
// 			Visualizer.marker(this.recoveryWaypoint, {color: 'green'});
// 		}
// 	}
// }
