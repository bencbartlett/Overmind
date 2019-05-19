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

	getConstructionSites(): ConstructionSite | undefined {
		if (!this.pos.isVisible) {
			return;
		}
		const room = Game.rooms[this.pos.roomName]
		const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
		const containersInConstructionSites = _.filter(constructionSites, s => s.structureType == STRUCTURE_CONTAINER);

		if(containersInConstructionSites.length > 0){
			return containersInConstructionSites[0];	
		}			
		return;
	}

	getContainersToRepair(): Structure | undefined {
		if (!this.pos.isVisible) {
			return;
		}
		const room = Game.rooms[this.pos.roomName]
		const allStrcutures = room.find(FIND_STRUCTURES);
		const containersTorepair = _.filter(allStrcutures, s => s.structureType == STRUCTURE_CONTAINER && s.hits < 0.5 * s.hitsMax);

		if(containersTorepair.length > 0){
			return containersTorepair[0];	
		}			
		return;
	}

	init(): void {
		// Add this structure/CS to worker overlord's build/repair list
		const container = this.getContainersToRepair();
		if (container && !this.colony.overlords.work.repairStructures.includes(container)) {
			this.colony.overlords.work.repairStructures.push(container);
			return;
		}

		const target = this.getConstructionSites();
		if (target && !this.colony.overlords.work.constructionSites.includes(target)) {
			this.colony.overlords.work.constructionSites.push(target);
			return;
		}
	}

	run(): void {

	}
}