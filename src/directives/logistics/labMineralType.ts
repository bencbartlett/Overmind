import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';


interface DirectiveLabMineralMemory extends FlagMemory {
	mineralType?: _ResourceConstantSansEnergy
}

@profile
export class DirectiveLabMineral extends Directive {

	static directiveName = 'labMineralType';
	static color = COLOR_CYAN;
	static secondaryColor = COLOR_CYAN;

	memory: DirectiveLabMineralMemory;

	constructor(flag: Flag) {
		super(flag);
	}

	get lab(): StructureLab | undefined {
		return this.pos.lookForStructure(STRUCTURE_LAB) as StructureLab | undefined;
	}

	get mineralType(): _ResourceConstantSansEnergy | undefined {
		return this.memory.mineralType;
	}

	init(): void {

	}

	run(): void {

	}


}

