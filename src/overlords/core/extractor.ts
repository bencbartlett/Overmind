import {Overlord} from '../Overlord';
import {ExtractionSite} from '../../hiveClusters/extractionSite';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {profile} from '../../profiler/decorator';
import {DEFCON} from '../../Colony';
import {CreepSetup} from '../CreepSetup';

const DroneSetup = new CreepSetup('drone', {
	pattern  : [WORK, WORK, CARRY, MOVE],
	sizeLimit: Infinity,
});

@profile
export class ExtractorOverlord extends Overlord {

	drones: Zerg[];
	extractionSite: ExtractionSite;

	constructor(extractionSite: ExtractionSite, priority: number) {
		super(extractionSite, 'mineral', priority);
		this.drones = this.creeps(DroneSetup.role);
		this.extractionSite = extractionSite;
	}

	init() {
		let amount = this.extractionSite.mineral.mineralAmount > 0 ? 1 : 0;
		this.wishlist(amount, DroneSetup);
	}

	private handleDrone(drone: Zerg): void {
		// Ensure you are in the assigned room
		if (drone.room == this.room && !drone.pos.isEdge) {
			if (_.sum(drone.carry) == 0) {
				drone.task = Tasks.harvest(this.extractionSite.mineral);
			}
			// Else see if there is an output to depsit to or to maintain
			else if (this.extractionSite.output) {
				drone.task = Tasks.transferAll(this.extractionSite.output);
				// Move onto the output container if you're the only drone
				if (!drone.pos.isEqualTo(this.extractionSite.output.pos) && this.drones.length == 1) {
					drone.travelTo(this.extractionSite.output, {range: 0});
				}
			}
		} else {
			drone.travelTo(this.extractionSite);
		}
	}

	private fleeResponse(drone: Zerg): void {
		if (drone.room == this.colony.room) {
			// If there is a large invasion happening in the colony room, flee
			if (this.colony.defcon > DEFCON.invasionNPC) {
				drone.task = Tasks.flee(this.colony.controller);
			}
		} else {
			// If there are baddies in the room, flee
			if (drone.room.dangerousHostiles.length > 0) {
				drone.task = Tasks.flee(this.colony.controller);
			}
		}
	}

	run() {
		for (let drone of this.drones) {
			if (drone.isIdle) {
				this.handleDrone(drone);
			}
			// this.fleeResponse(drone);
			drone.run();
		}
	}
}
