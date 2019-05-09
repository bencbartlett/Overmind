import {CombatOverlord} from '../../overlords/CombatOverlord';
import {Overseer} from '../../Overseer';
import {Directive} from '../Directive';

export abstract class DefenseDirective extends Directive {

	overlord: CombatOverlord;
	overlords: {};

	constructor(flag: Flag) {
		super(flag);
		(<Overseer>Overmind.overseer).combatPlanner.directives.push(this);
	}


}
