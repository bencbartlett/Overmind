import {Pathing} from '../../movement/Pathing';
import {DismantleOverlord} from '../../overlords/situational/dismantler';
import {AttackStructurePriorities} from '../../priorities/priorities_structures';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';


interface DirectiveModularDismantleMemory extends FlagMemory {
	targetId?: string;
	numberSpots?: number;
	attackInsteadOfDismantle?: boolean;
	onlyKillRampart?: boolean;
	additionalTargets?: StructureConstant[];
	boost?: boolean;
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

	constructor(flag: Flag, onlyKillRampart = false, additionalTargets?: StructureConstant[]) {
		super(flag);
		this.memory.onlyKillRampart = onlyKillRampart || this.flag.name.includes('rampart');
		this.memory.boost = this.memory.boost || this.flag.name.includes('boost');
		if (this.flag.room) {
			if (!this.memory.targetId) {
				const target = this.getTarget();
				this.memory.targetId = target ? target.id : undefined;
			}
			this.memory.additionalTargets = additionalTargets;
			if (!this.memory.numberSpots) {
				const spots = this.getDismantleSpots(this.flag.pos);
				if (spots) {
					this.memory.numberSpots = spots.length;
				}
			}
		}
	}

	spawnMoarOverlords() {
		this.overlords.dismantle = new DismantleOverlord(this);
	}

	getTarget(): Structure | undefined {
		if (!this.pos.isVisible) {
			return;
		}
		const targetedStructureTypes = this.memory.onlyKillRampart ? [STRUCTURE_RAMPART] : AttackStructurePriorities;
		const targets = this.pos.lookFor(LOOK_STRUCTURES) as Structure[];
		for (const structureType of targetedStructureTypes) {
			const correctTargets = targets.filter(target => {
				if (target.structureType == structureType) {
					return target;
				} else if (target.structureType == STRUCTURE_INVADER_CORE) {
					this.memory.attackInsteadOfDismantle = true;
					return target;
				}
			});
			if (correctTargets.length > 0) {
				return correctTargets[0];
			}
			// for (const structure of targets) {
			// 	if (structure.structureType == structureType) {
			// 		return structure;
			// 	}
			// 	if (structure.structureType == STRUCTURE_INVADER_CORE) {
			// 		this.memory.attackInsteadOfDismantle = true;
			// 		return structure;
			// 	}
			// }
		}
	}

	getDismantleSpots(target: RoomPosition): RoomPosition[] | undefined {
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
		let hits = '???';
		const target = this.getTarget();
		hits = target ? (target.hits / 1000).toString() + 'K' : hits;
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

