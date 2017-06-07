// Claimer: claims a new room
import {TaskGoToRoom} from '../tasks/task_goToRoom';
import {TaskSignController} from '../tasks/task_signController';
import {TaskClaim} from '../tasks/task_claim';
import {AbstractCreep, AbstractSetup} from './Abstract';

export class ClaimerSetup extends AbstractSetup {
	constructor() {
		super('claimer');
		// Role-specific settings
		this.settings.bodyPattern = [CLAIM, MOVE];
		this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(CLAIM) > 1 &&
												  creep.getActiveBodyparts(MOVE) > 1;
	}
}

export class ClaimerCreep extends AbstractCreep {
	assignment: Flag;

	constructor(creep: Creep) {
		super(creep);
	}

	newTask() {
		// If no vision of the room, go to it
		if (!this.assignment.room) {
			this.task = new TaskGoToRoom(this.assignment);
		} else {
			if (this.assignment.room.my) {
				return this.suicide(); // Suicide when the room is claimed
			}
			// If there is vision of the room, sign and/or reserve the controller
			let controller = this.assignment.room.controller!;
			if (!controller.signedByMe) { // Sign the controller if applicable
				this.task = new TaskSignController(controller);
			} else { // Reserve the controller
				this.task = new TaskClaim(controller);
			}
		}
	}
}
