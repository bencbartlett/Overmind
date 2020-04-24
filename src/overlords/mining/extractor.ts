import {$} from '../../caching/GlobalCache';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveExtract} from '../../directives/resource/extract';
import {Pathing} from '../../movement/Pathing';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
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

	// If mineral is ready to be mined, make a container
	private shouldHaveContainer() {
		return this.mineral && (this.mineral.mineralAmount > 0 || this.mineral.ticksToRegeneration < 2000);
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
			const outputThreshold = this.drones.length == 0 ? this.container.store.getCapacity() : 0;
			if (this.container.store.getUsedCapacity() > outputThreshold) {
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
		// Create container if there is not already one being built
		if (!this.container && this.shouldHaveContainer()) {
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
		this.registerOutputRequests();

		const amount = this.mineral && this.mineral.mineralAmount > 0 && this.extractor && this.container
					   ? Math.min(this.mineral.pos.availableNeighbors().length, ExtractorOverlord.settings.maxDrones)
					   : 0;
		this.wishlist(amount, Setups.drones.extractor);
	}

	private handleDrone(drone: Zerg) {
		// Stay safe out there!
		if (drone.avoidDanger({timer: 10, dropEnergy: true})) {
			return;
		}
		// Ensure you are in the assigned room
		if (drone.room == this.room && !drone.pos.isEdge) {
			if (this.mineral && !drone.pos.inRangeToPos(this.mineral.pos, 1)) {
				return drone.goTo(this.mineral.pos);
			}
			if (this.mineral) {
				// Do harvest first - needs to check if in range anyway so this is more CPU efficient
				const ret = drone.harvest(this.mineral);
				if (ret == ERR_NOT_IN_RANGE) {
					return drone.goTo(this.mineral);
				}
				if (this.container) {
					// Transfer to container if you need to (can do at same tick as harvest)
					if (drone.store.getUsedCapacity() > 0.9 * drone.store.getCapacity()) {
						const transfer = drone.transferAll(this.container);
						if (transfer == ERR_NOT_IN_RANGE) {
							return drone.goTo(this.container, {range: 1});
						}
					}
					// Move onto the container pos if you need to
					if (this.drones.length == 1 && !drone.pos.isEqualTo(this.container.pos)) {
						return drone.goTo(this.container, {range: 0});
					}
				}
			} else {
				log.error(`${this.print}: room defined and no mineral! (Why?)`);
			}
		} else {
			drone.goTo(this);
		}
	}

	run() {
		_.forEach(this.drones, drone => this.handleDrone(drone));
		if (this.room && Game.time % BUILD_OUTPUT_FREQUENCY == 2) {
			this.buildOutputIfNeeded();
		}
	}
}
