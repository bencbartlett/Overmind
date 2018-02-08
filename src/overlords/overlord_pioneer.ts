import {Overlord} from './Overlord';
import {Priority} from '../config/priorities';
import {Zerg} from '../Zerg';
import {Tasks} from '../tasks/Tasks';
import {Directive} from '../directives/Directive';
import {PioneerSetup} from '../creepSetup/defaultSetups';

export class PioneerOverlord extends Overlord {

	pioneers: Zerg[];
	spawnSite: ConstructionSite | undefined;

	constructor(directive: Directive, priority = Priority.NormalHigh) {
		super(directive, 'pioneer', priority);
		this.pioneers = this.creeps('pioneer');
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	spawn() {
		this.wishlist(4, new PioneerSetup());
	}

	init() {
		this.spawn();
	}

	private handlePioneer(pioneer: Zerg): void {
		// Ensure you are in the assigned room
		if (pioneer.room == this.room && !pioneer.pos.isEdge) {
			// Harvest if out of energy
			if (pioneer.carry.energy == 0) {
				let availableSources = _.filter(this.room.sources, function (source) {
					return source.energy > 0 &&
						   _.filter(source.pos.neighbors, pos => pos.isPassible()).length > 0;
				});
				pioneer.task = Tasks.harvest(pioneer.pos.findClosestByRange(availableSources));
			} else if (this.spawnSite) {
				pioneer.task = Tasks.build(this.spawnSite);
			}
		} else {
			pioneer.task = Tasks.goTo(this.pos);
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

