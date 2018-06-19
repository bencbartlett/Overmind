import {Overlord} from '../Overlord';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';

const PioneerSetup = new CreepSetup('pioneer', {
	pattern  : [WORK, CARRY, MOVE, MOVE],
	sizeLimit: Infinity,
});

@profile
export class PioneerOverlord extends Overlord {

	pioneers: Zerg[];
	spawnSite: ConstructionSite | undefined;

	constructor(directive: Directive, priority = OverlordPriority.realTime.pioneer) {
		super(directive, 'pioneer', priority);
		this.pioneers = this.creeps(PioneerSetup.role);
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	init() {
		this.wishlist(4, PioneerSetup);
	}

	private handlePioneer(pioneer: Zerg): void {
		// Ensure you are in the assigned room
		if (pioneer.room == this.room && !pioneer.pos.isEdge) {
			// Harvest if out of energy
			if (pioneer.carry.energy == 0) {
				let availableSources = _.filter(this.room.sources,
												s => s.energy > 0 && s.pos.availableNeighbors().length > 0);
				let target = pioneer.pos.findClosestByRange(availableSources);
				if (target) pioneer.task = Tasks.harvest(target);
			} else if (this.spawnSite) {
				pioneer.task = Tasks.build(this.spawnSite);
			}
		} else {
			// pioneer.task = Tasks.goTo(this.pos);
			pioneer.goTo(this.pos, {ensurePath: true, preferHighway: true});
		}
	}

	run() {
		for (let pioneer of this.pioneers) {
			if (pioneer.isIdle) {
				this.handlePioneer(pioneer);
			}
			pioneer.run();
		}
	}
}

