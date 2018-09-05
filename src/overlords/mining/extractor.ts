import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {profile} from '../../profiler/decorator';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {DirectiveExtract} from '../../directives/core/extract';
import {$} from '../../caching/GlobalCache';
import {Roles, Setups} from '../../creepSetups/setups';

@profile
export class ExtractorOverlord extends Overlord {

	directive: DirectiveExtract;
	room: Room | undefined;
	extractor: StructureExtractor | undefined;
	mineral: Mineral | undefined;
	container: StructureContainer | undefined;
	drones: Zerg[];

	static settings = {
		maxDrones: 2,
	};

	constructor(directive: DirectiveExtract, priority: number) {
		super(directive, 'mineral', priority);
		this.directive = directive;
		this.priority += this.outpostIndex * OverlordPriority.remoteSKRoom.roomIncrement;
		this.drones = this.zerg(Roles.drone);
		// Populate structures
		this.populateStructures();
	}

	private populateStructures() {
		if (Game.rooms[this.pos.roomName]) {
			this.extractor = this.pos.lookForStructure(STRUCTURE_EXTRACTOR) as StructureExtractor | undefined;
			this.mineral = this.pos.lookFor(LOOK_MINERALS)[0];
			this.container = this.pos.findClosestByLimitedRange(Game.rooms[this.pos.roomName].containers, 1);
		}
	}

	refresh() {
		if (!this.room && Game.rooms[this.pos.roomName]) { // if you just gained vision of this room
			this.populateStructures();
		}
		super.refresh();
		$.refresh(this, 'extractor', 'mineral', 'container');
	}

	private registerOutputRequests(): void {
		if (this.container) {
			if (_.sum(this.container.store) > 0.5 * this.container.storeCapacity ||
				(_.sum(this.container.store) > 0 && this.drones.length == 0)) {
				this.colony.logisticsNetwork.requestOutput(this.container, {resourceType: 'all'});
			}
		}
	}

	init() {
		let amount = this.mineral && this.mineral.mineralAmount > 0 ? this.mineral.pos.availableNeighbors().length : 0;
		this.wishlist(Math.min(amount, ExtractorOverlord.settings.maxDrones), Setups.drones.extractor);
		this.registerOutputRequests();
	}

	private handleDrone(drone: Zerg): void {
		// Ensure you are in the assigned room
		if (drone.room == this.room && !drone.pos.isEdge) {
			if (_.sum(drone.carry) == 0) {
				drone.task = Tasks.harvest(this.mineral!);
			}
			// Else see if there is an output to depsit to or to maintain
			else if (this.container) {
				drone.task = Tasks.transferAll(this.container);
				// Move onto the output container if you're the only drone
				if (!drone.pos.isEqualTo(this.container.pos) && this.drones.length == 1) {
					drone.goTo(this.container, {range: 0});
				}
			}
		} else {
			drone.goTo(this);
		}
	}

	run() {
		this.autoRun(this.drones, drone => this.handleDrone(drone), drone => drone.flee());
	}
}
