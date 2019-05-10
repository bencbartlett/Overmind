import {$} from '../../caching/GlobalCache';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveExtract} from '../../directives/resource/extract';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Tasks} from '../../tasks/Tasks';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';

const BUILD_OUTPUT_FREQUENCY = 15;

/**
 * Spawns extractors to harvest minerals in an owned or sourcekeeper room
 */
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

	/* Calculate where the container output will be built for this site */
	private calculateContainerPos(): RoomPosition {
		// log.debug(`Computing container position for mining overlord at ${this.pos.print}...`);
		let originPos: RoomPosition | undefined;
		if (this.colony.storage) {
			originPos = this.colony.storage.pos;
		} else if (this.colony.roomPlanner.storagePos) {
			originPos = this.colony.roomPlanner.storagePos;
		}
		if (originPos) {
			const path = Pathing.findShortestPath(this.pos, originPos).path;
			const pos = _.find(path, pos => pos.getRangeTo(this) == 1);
			if (pos) return pos;
		}
		// Shouldn't ever get here
		log.warning(`Last resort container position calculation for ${this.print}!`);
		return _.first(this.pos.availableNeighbors(true));
	}

	private buildOutputIfNeeded(): void {
		// Create container if there is not already one being built and no link
		if (!this.container) {
			const containerSite = _.first(_.filter(this.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 2),
												 site => site.structureType == STRUCTURE_CONTAINER));
			if (!containerSite) {
				const containerPos = this.calculateContainerPos();
				log.info(`${this.print}: building container at ${containerPos.print}`);
				const result = containerPos.createConstructionSite(STRUCTURE_CONTAINER);
				if (result != OK) {
					log.error(`${this.print}: cannot build container at ${containerPos.print}! Result: ${result}`);
				}
				return;
			}
		}
	}

	init() {
		const amount = this.mineral && this.mineral.mineralAmount > 0 ? this.mineral.pos.availableNeighbors().length : 0;
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
		if (this.room && Game.time % BUILD_OUTPUT_FREQUENCY == 2) {
			this.buildOutputIfNeeded();
		}
	}
}
