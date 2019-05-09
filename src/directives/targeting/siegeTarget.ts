import {AttackStructurePriorities} from '../../priorities/priorities_structures';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';

/**
 * [LEGACY] Manually specify targets to be prioritized during a siege
 */
@profile
export class DirectiveTargetSiege extends Directive {

	static directiveName = 'target:siege';
	static color = COLOR_GREY;
	static secondaryColor = COLOR_ORANGE;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {

	}

	getTarget(): Structure | undefined {
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

	}

	run(): void {
		// Remove the directive once structures have been destroyed
		if (this.pos.isVisible && !this.getTarget()) {
			this.remove();
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'orange'});
	}
}

