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
	static containerRepairTheshold = 0.5;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 7);
	}

	spawnMoarOverlords() {
		//TODO: skip sourceReapoers for safe SKrooms
		this.overlords.sourceReaper = new SourceReaperOverlord(this);
	}

	getContainerConstructionSites(): ConstructionSite | undefined {
		if (!this.pos.isVisible) {
			return;
		}
		const ContainerConstructionSites = _.filter(this.room!.constructionSites, s => s.structureType == STRUCTURE_CONTAINER);

		if(ContainerConstructionSites.length > 0){
			return ContainerConstructionSites[0];	
		}			
		return;
	}

	getContainersToRepair(): Structure | undefined {
		if (!this.pos.isVisible) {
			return;
		}
		const containersTorepair = _.filter(this.room!.structures, s => s.structureType == STRUCTURE_CONTAINER && s.hits < DirectiveSKOutpost.containerRepairTheshold * s.hitsMax);

		if(containersTorepair.length > 0){
			return containersTorepair[0];	
		}			
		return;
	}

	init(): void {
		// Add this structure/CS to worker overlord's build/repair list
		const containerNeedRepair = this.getContainersToRepair();
		if (containerNeedRepair && !this.colony.overlords.work.repairStructures.includes(containerNeedRepair)) {
			this.colony.overlords.work.repairStructures.push(containerNeedRepair);
			return;
		}

		const containerToBuild = this.getContainerConstructionSites();
		if (containerToBuild && !this.colony.overlords.work.constructionSites.includes(containerToBuild)) {
			this.colony.overlords.work.constructionSites.push(containerToBuild);
			return;
		}
	}

	run(): void {

	}
}