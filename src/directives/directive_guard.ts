import {Directive} from './Directive';
import {GuardSetup} from '../roles/guard';
import {profile} from '../lib/Profiler';

@profile
export class DirectiveGuard extends Directive {
	guards: ICreep[];
	invasionHappening: boolean;
	colony: IColony; 				// Guard flag definitely has a colony

	static directiveName = 'guard';
	static colorCode = {
		color         : COLOR_RED,
		secondaryColor: COLOR_BLUE,
	};

	constructor(flag: Flag) {
		super(flag);
		this.guards = this.getAssignedCreeps('guard');
		this.invasionHappening = this.room == undefined ||
								 this.room.hostiles.length > 0 ||
								 this.room.hostileStructures.length > 0;
	}

	private reassignIdleGuards(): void {
		// Find all idle guards
		let idleGuards = _.filter(this.colony.getCreepsByRole('guard'), (guard: ICreep) => !guard.assignment);
		// Reassign them all to this flag
		for (let guard of idleGuards) {
			guard.assignment = this.flag;
		}
		// Refresh the list of guards
		this.guards = this.getAssignedCreeps('guard');
	}


	init(): void {
		// Reassign any idle guards
		this.reassignIdleGuards();
		// If there are insufficient guards assigned, spawn more
		if (this.guards.length < 1 && this.colony.hatchery) {	// TODO: figure out how many guards are needed
			this.colony.hatchery.enqueue(
				new GuardSetup().create(this.colony, {
					assignment            : this.flag,
					patternRepetitionLimit: 3,
				}));
		}
	}

	run(): void {
		// If there are no hostiles left in the room, remove the flag
		if (!this.invasionHappening) {
			for (let guard of this.guards) {
				guard.assignment = null;
			}
			this.remove();
			return;
		}
	}
}
