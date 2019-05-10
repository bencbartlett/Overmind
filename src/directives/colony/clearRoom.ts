import {log} from '../../console/log';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {hasContents, printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';
import {DirectiveDismantle} from "../targeting/dismantle";
import {Pathing} from "../../movement/Pathing";
import {DirectiveHaul} from "../resource/haul";
import {Zerg} from "../../zerg/Zerg";


/**
 * Claims a new room, destroys all structures in the room, then unclaims it
 */
@profile
export class DirectiveClearRoom extends Directive {

	static directiveName = 'clearRoom';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_ORANGE;

	overlords: {
		claim: ClaimingOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 3);
		// Remove if misplaced
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
						`removing directive!`);
			this.remove(true);
		}
		if (Memory.settings.resourceCollectionMode && Memory.settings.resourceCollectionMode >= 1) {
			this.memory.keepStorageStructures = true;
		}
	}

	spawnMoarOverlords() {
		this.overlords.claim = new ClaimingOverlord(this);
	}

	init() {
		this.alert(`Clearing out room`);
	}

	private removeAllStructures(): boolean {

		const keepStorageStructures = this.memory.keepStorageStructures !== undefined
									? this.memory.keepStorageStructures : true;
		const keepRoads = this.memory.keepRoads !== undefined ? this.memory.keepRoads : true;
		const keepContainers = this.memory.keepContainers !== undefined ? this.memory.keepContainers : true;

		if (this.room) {
			const allStructures = this.room.find(FIND_STRUCTURES);
			let i = 0;
			for (const s of allStructures) {
				if (s.structureType == STRUCTURE_CONTROLLER) continue;
				if (keepStorageStructures &&
					(s.structureType == STRUCTURE_STORAGE || s.structureType == STRUCTURE_TERMINAL) && hasContents(s.store)) {
					// Create a collection flag
					let result = s.pos.createFlag(undefined, DirectiveHaul.color, DirectiveHaul.secondaryColor);
					continue;
				}
				if (keepRoads && s.structureType == STRUCTURE_ROAD) {
					continue;
				}
				if (keepContainers && s.structureType == STRUCTURE_CONTAINER) {
					continue;
				}
				const result = s.destroy();
				if (result == OK) {
					i++;
				}
			}
			log.alert(`Destroyed ${i} structures in ${this.room.print}.`);
			return true;
		} else {
			return false;
		}

	}

	private findStructureBlockingController(pioneer: Zerg): Structure | undefined {
		let blockingPos = Pathing.findBlockingPos(pioneer.pos, pioneer.room.controller!.pos,
			_.filter(pioneer.room.structures, s => !s.isWalkable));
		if (blockingPos) {
			let structure = blockingPos.lookFor(LOOK_STRUCTURES)[0];
			if (structure) {
				return structure;
			} else {
				log.error(`${this.print}: no structure at blocking pos ${blockingPos.print}! (Why?)`);
			}
		}
	}

	run() {
		// Remove if structures are done
		if (this.room && this.room.my) {
			const done = this.removeAllStructures();
			if (done) {
				this.room.controller!.unclaim();
				log.notify(`Removing clearRoom directive in ${this.pos.roomName}: operation completed.`);
				this.remove();
			}
		// Clear path if controller is not reachable
		} else if (this.room && this.room.creeps.length > 1) {
			let currentlyDismantling = _.find(this.room.flags, function(flag) {
				return (flag.color == DirectiveDismantle.color && flag.secondaryColor == DirectiveDismantle.secondaryColor)
			});

			if (!currentlyDismantling) {
				let pathablePos = this.room.creeps[0] ? this.room.creeps[0].pos
					: Pathing.findPathablePosition(this.room.name);
				let blockingLocation = Pathing.findBlockingPos(pathablePos, this.room.controller!.pos,
					_.filter(this.room.structures, s => !s.isWalkable));
				if (blockingLocation && blockingLocation.lookFor(LOOK_FLAGS).length <= 0) {
					log.notify(`Adding dismantle directive for ${this.pos.roomName} to reach controller.`);
					blockingLocation!.createFlag(undefined, DirectiveDismantle.color, DirectiveDismantle.secondaryColor);
				}
			}
		}

		// Remove if owned by other player
		if (Game.time % 10 == 2 && this.room && !!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing clearRoom directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
	}
}
