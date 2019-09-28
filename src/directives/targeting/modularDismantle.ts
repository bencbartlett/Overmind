import {AttackStructurePriorities} from '../../priorities/priorities_structures';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';
import {DismantleOverlord} from "../../overlords/situational/dismantler";
import {Pathing} from "../../movement/Pathing";


interface DirectiveModularDismantleMemory extends FlagMemory {
	targetId?: string;
	numberSpots?: number;
}
/**
 * Register a target to be dismantled by specific dismantlers
 */
@profile
export class DirectiveModularDismantle extends Directive {

	static directiveName = 'modularDismantle';
	static color = COLOR_GREY;
	static secondaryColor = COLOR_CYAN;
	memory: DirectiveModularDismantleMemory;

	constructor(flag: Flag) {
		super(flag);

		if (this.flag.room) {
			if (!this.memory.targetId) {
				const target = this.getTarget();
				this.memory.targetId = target ? target.id : undefined;
			}
			if (!this.memory.numberSpots) {
				let spots = this.getDismantleSpots(this.flag.pos);
				if (spots) {
					this.memory.numberSpots = spots.length;
				}
			}
		}
	}

	spawnMoarOverlords() {
		this.overlords.dismantle = new DismantleOverlord(this, undefined);
	}

	getTarget(): Structure | undefined {
		if (!this.pos.isVisible) {
			return;
		}
		const targetedStructures = this.pos.lookFor(LOOK_STRUCTURES) as Structure[];
		for (const structure of targetedStructures) {
			for (const structureType of AttackStructurePriorities) {
				if (structure.structureType == structureType) {
					return structure;
				}
			}
		}
	}

	getDismantleSpots(target: RoomPosition) {
		const nearbySpots = target.availableNeighbors(true);
		if (target.room && target.room.creeps.length > 0) {
			const startingCreep = target.room.creeps.filter(creep => creep.my)[0];
			if (!!startingCreep) {
				const obstacles = _.filter(target.room.structures, s => !s.isWalkable);
				return _.filter(nearbySpots, spot => Pathing.isReachable(startingCreep.pos, spot, obstacles));
			}
		}
	}

	init(): void {
		let hits = "???";
		const target = this.getTarget();
		hits = target ? target.hits.toString() : hits;
		this.alert(`Dismantling: ${hits}`);
	}

	run(): void {

		// Remove the directive once structures have been destroyed
		if (this.pos.isVisible && !this.getTarget()) {
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'yellow'});
	}
}

