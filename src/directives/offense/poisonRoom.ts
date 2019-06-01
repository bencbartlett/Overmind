import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {WorkerOverlord} from '../../overlords/core/worker';
import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';


/**
 * Poison sources in remote rooms by claiming controller, walling in its sources and controller then unclaiming it.
 */
@profile
export class DirectivePoisonRoom extends Directive {

	static directiveName = 'poisonRoom';
	static color = COLOR_RED;
	static secondaryColor = COLOR_BROWN;

	overlords: {
        claim: ClaimingOverlord;
        work: WorkerOverlord;
	};

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 4);
		// Remove if misplaced
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
						`removing directive!`);
			this.remove(true);
		}
	}

	spawnMoarOverlords() {
        this.overlords.claim = new ClaimingOverlord(this);
        this.overlords.work = new WorkerOverlord(this.colony);
	}

	init() {
		this.alert(`Poisining Room ${this.pos.roomName}`);
	}

	private isPoisoned(): boolean {
		if (this.room) {
            const allSources = this.room.find(FIND_SOURCES);
            let result = true;
            //Check for walkable source.pos.neighbors and place wall constuction site
            for (const s of allSources) {
                let walkableSourcePosisions =  _.filter(s.pos.neighbors, pos => pos.isWalkable());
                if(walkableSourcePosisions.length){
                    _.forEach(walkableSourcePosisions,pos=>{pos.createConstructionSite(STRUCTURE_WALL)});
                }
                result = result && !walkableSourcePosisions.length;
            }
            //Check for walkable controller.pos.neighbors and place wall constuction site
            let walkableControllerPosisions =  _.filter(this.room.controller!.pos.neighbors, pos => pos.isWalkable());
            if(walkableControllerPosisions.length){
                _.forEach(walkableControllerPosisions,pos=>{pos.createConstructionSite(STRUCTURE_WALL)});
            }
            result = result && !walkableControllerPosisions.length;
			return result;
		} else {
			return false;
		}
	}

    private getWallsConstructionSites() {
        const room = Game.rooms[this.pos.roomName];
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        const wallsConstructionSites = _.filter(constructionSites, s => s.structureType == STRUCTURE_WALL);
        return wallsConstructionSites;
    }

	run() {
		
		if (this.room && this.room.my) {
            // Remove if poisoned
			if (this.isPoisoned()) {
				this.room.controller!.unclaim();
				log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: operation completed.`);
				this.remove();
			} else {
            //Assign workers to wall sources and controller
                const wallsConstructionSites = this.getWallsConstructionSites();
                _.forEach(wallsConstructionSites,csite => {
                    if (!this.colony.overlords.work.constructionSites.includes(csite)) {
                        this.colony.overlords.work.constructionSites.push(csite);
                        return;
                    }
                })
            }
		}

		// Remove if owned by other player
		if (Game.time % 10 == 2 && this.room && !!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing poisonRoom directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
	}
}





