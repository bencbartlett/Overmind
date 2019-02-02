import {Directive} from '../Directive';
import {Overseer} from '../../Overseer';
import {CombatOverlord} from '../../overlords/CombatOverlord';

export abstract class DefenseDirective extends Directive {

	overlord: CombatOverlord;
	overlords: {};

	constructor(flag: Flag) {
		super(flag);
		(<Overseer>Overmind.overseer).combatPlanner.directives.push(this);
	}


}