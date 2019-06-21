import {SourceReaperOverlord} from '../../overlords/mining/sourceKeeperReeper';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CORE} from '../../utilities/Cartographer';
import {Directive} from '../Directive';


/**
 * Remote mining directive for source keeper rooms
 */
@profile
export class DirectiveSKOutpost extends Directive {

	static directiveName = 'outpostSK';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_YELLOW;
	static containerRepairTheshold = 0.75;

	isCenterRoom: boolean;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 7);
		this.isCenterRoom = Cartographer.roomType(this.pos.roomName) == ROOMTYPE_CORE;
	}

	spawnMoarOverlords() {
		// skip sourceReapoers for safe SKrooms
		if(!this.isCenterRoom) {
			this.overlords.sourceReaper = new SourceReaperOverlord(this);
		}
	}

	getContainerConstructionSites(): ConstructionSite | undefined {
		if (!this.pos.isVisible || (this.room && this.room.mineral && this.room.mineral.mineralAmount == 0)) {
			return;
		}
		const ContainerCSites = _.filter(this.room!.constructionSites, s => s.structureType == STRUCTURE_CONTAINER);

		if(ContainerCSites.length > 0) {
			return ContainerCSites[0];	
		}			
		return;
	}

	getContainersToRepair(): Structure | undefined {
		if (!this.pos.isVisible || (this.room && this.room.mineral && this.room.mineral.mineralAmount == 0)) {
			return;
		}
		const containersTorepair = _.filter(this.room!.structures, s => s.structureType == STRUCTURE_CONTAINER && 
											s.hits < DirectiveSKOutpost.containerRepairTheshold * s.hitsMax);

		if(containersTorepair.length > 0) {
			return containersTorepair[0];	
		}			
		return;
	}

	init(): void {
		// Add this structure/CS to worker overlord's build/repair list
		if(Game.time % 25 == 0) {
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
	}

	run(): void {

	}
}
