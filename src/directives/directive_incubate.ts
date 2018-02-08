import {profile} from '../lib/Profiler';
import {Directive} from './Directive';
import {ClaimingOverlord} from '../overlords/overlord_claim';
import {Colony, ColonyStage} from '../Colony';

// Claims a new room and incubates it from the nearest (or specified) colony

@profile
export class DirectiveIncubate extends Directive {

	static directiveName = 'incubate';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_WHITE;

	incubatingColony: Colony | undefined;

	constructor(flag: Flag) {
		super(flag);
		// Register incubation status
		this.incubatingColony = this.room ? Overmind.Colonies[Overmind.colonyMap[this.room.name]] : undefined;
		if (this.incubatingColony && this.colony != this.incubatingColony) {
			// this.colony is from Flag memory and is the incubator; this.room.colony is the new colony
			this.incubatingColony.incubator = this.colony;
			this.incubatingColony.isIncubating = true;
			this.colony.incubatingColonies.push(this.incubatingColony);
			if (!this.incubatingColony.hatchery && this.colony.hatchery) {
				this.incubatingColony.hatchery = this.colony.hatchery;
			}
		}
		this.overlords.claim = new ClaimingOverlord(this);
	}

	init() {

	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (this.incubatingColony && this.incubatingColony.stage > ColonyStage.Larva) {
			this.remove();
		}
		// // You can set memory.onlyBuildSpawn = true to remove the flag once spawn is built, skipping incubation
		// if (this.memory.onlyBuildSpawn && this.incubatingColony && this.incubatingColony.spawns.length > 0) {
		// 	this.remove();
		// }
	}
}
