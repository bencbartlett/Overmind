import {SourceReaperOverlord} from '../../overlords/mining/sourceKeeperReeper';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';


/**
 * Remote mining directive for source keeper rooms
 */
@profile
export class DirectiveSKOutpost extends Directive {

	static directiveName = 'outpostSK';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_YELLOW;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 7);
	}

	spawnMoarOverlords() {
		this.overlords.sourceReaper = new SourceReaperOverlord(this);
	}

	getTarget(): ConstructionSite | undefined {
		if (!this.pos.isVisible) {
			return;
		}
		const ConstructionSite = _.find(this.pos.lookFor(LOOK_CONSTRUCTION_SITES), s =>
					s.structureType == STRUCTURE_CONTAINER) as ConstructionSite;
		return ConstructionSite;
	}

	init(): void {
		// Add this structure to worker overlord's build list
		const target = this.getTarget();
		if (target && !this.colony.overlords.work.constructionSites.includes(target)) {
			this.colony.overlords.work.constructionSites.push(target);
		}
	}

	run(): void {

	}
}

