import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {AttackStructurePriorities} from '../../priorities/priorities_structures';

@profile
export class DirectiveTargetSiege extends Directive {

	static directiveName = 'target:siege';
	static color = COLOR_GREY;
	static secondaryColor = COLOR_ORANGE;

	constructor(flag: Flag) {
		super(flag);
	}

	getTarget(): Structure | undefined {
		let targetedStructures = this.pos.lookFor(LOOK_STRUCTURES) as Structure[];
		for (let structure of targetedStructures) {
			for (let structureType of AttackStructurePriorities) {
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

