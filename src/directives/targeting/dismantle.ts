import {AttackStructurePriorities} from '../../priorities/priorities_structures';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

/**
 * Register a target to be dismantled by workers. This is not a siege directive, and clearing rooms should
 * be done with the DirectiveRoomClear
 */
@profile
export class DirectiveDismantle extends Directive {

	static directiveName = 'dismantle';
	static color = COLOR_GREY;
	static secondaryColor = COLOR_YELLOW;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {

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

	init(): void {
		// Add this structure to worker overlord's dismantle list
		const target = this.getTarget();
		if (target && !this.colony.overlords.work.dismantleStructures.includes(target)) {
			this.colony.overlords.work.dismantleStructures.push(target);
		}
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

