import {DirectiveBaseOperator} from '../../directives/powerCreeps/baseOperator';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {PowerZergOperator} from '../../zerg/PowerZergOperator';
import {PowerOverlord, PowerOverlordMemory} from '../PowerOverlord';

interface OperatorOverlordMemory extends PowerOverlordMemory {

}

const getDefaultOperatorOverlordMemory: () => OperatorOverlordMemory = () => ({
	[MEM.TICK]: Game.time,
});

export class OperatorOverlord extends PowerOverlord {

	private operators: PowerZergOperator[];

	constructor(directive: DirectiveBaseOperator, priority = OverlordPriority.powerCreeps.default) {
		super(directive, 'operator', priority, getDefaultOperatorOverlordMemory);
		this.operators = this.powerZerg('baseOperator') as PowerZergOperator[];
	}

	init(): void {

	}

	run(): void {

	}


}

