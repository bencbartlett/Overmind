import {Overlord} from '../Overlord';
import {MineralSite} from '../../hiveClusters/mineralSite';
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
export class MineralOverlord extends Overlord {

	drones: Zerg[];
	mineralSite: MineralSite;

	constructor(mineralSite: MineralSite, priority: number) {
		super(mineralSite, 'mineral', priority);
		this.drones = this.creeps(DroneSetup.role);
		this.mineralSite = mineralSite;
	}

	init() {
		let creepSetup = DroneSetup;
		let filteredDrones = this.lifetimeFilter(this.drones);
		//let miningPowerAssigned = _.sum(_.map(filteredMiners, creep => creep.getActiveBodyparts(WORK)));
		//if (miningPowerAssigned < this.mineralSite.miningPowerNeeded &&
		//filteredMiners.length < _.filter(this.mineralSite.pos.neighbors, pos => pos.isPassible()).length) {
		if (filteredDrones.length < this.mineralSite.pos.availableNeighbors().length &&
			this.mineralSite.mineral.mineralAmount > 0) {
			// Handles edge case at startup of <3 spots near mining site
			this.requestCreep(creepSetup);
		}
		this.creepReport(creepSetup.role, filteredDrones.length, this.mineralSite.pos.availableNeighbors(true).length);
	}

	private handleDrone(drone: Zerg): void {
		// Ensure you are in the assigned room
		if (drone.room == this.room && !drone.pos.isEdge) {
			if (_.sum(drone.carry) == 0) {
				drone.task = Tasks.harvest(this.mineralSite.mineral);
			}
			// Else see if there is an output to depsit to or to maintain
			else if (this.mineralSite.output) {
				drone.task = Tasks.transferAll(this.mineralSite.output);
				// Move onto the output container if you're the only drone
				if (!drone.pos.isEqualTo(this.mineralSite.output.pos) && this.drones.length == 1) {
					drone.travelTo(this.mineralSite.output, {range: 0});
				}
			}
		} else {
			drone.travelTo(this.mineralSite);
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
		//handle drones
		for (let drone of this.drones) {
			if (drone.isIdle) {
				this.handleDrone(drone);
			}
			this.fleeResponse(drone);
			drone.run();
		}
		//calculate mineral per tick
		//let filteredDrones = _.filter(this.drones, drone => drone.pos.isNearTo(this.mineralSite.mineral.pos));
		//let miningPowerAssigned = _.sum(_.map(filteredDrones, drone => drone.getActiveBodyparts(WORK)));
		//this.mineralSite.mineralPerTick = miningPowerAssigned * HARVEST_MINERAL_POWER;
	}
}
