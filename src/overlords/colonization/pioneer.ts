import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Roles, Setups} from '../../creepSetups/setups';
import {DirectiveColonize} from '../../directives/colony/colonize';
import {Pathing} from '../../movement/Pathing';
import {log} from '../../console/log';

/**
 * Spawn pioneers - early workers which help to build a spawn in a new colony, then get converted to workers or drones
 */
@profile
export class PioneerOverlord extends Overlord {

	pioneers: Zerg[];
	spawnSite: ConstructionSite | undefined;

	constructor(directive: DirectiveColonize, priority = OverlordPriority.colonization.pioneer) {
		super(directive, 'pioneer', priority);
		this.pioneers = this.zerg(Roles.pioneer);
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	refresh() {
		super.refresh();
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	init() {
		this.wishlist(4, Setups.pioneer);
	}

	private findStructureBlockingController(pioneer: Zerg): Structure | undefined {
		let blockingPos = Pathing.findBlockingPos(pioneer.pos, pioneer.room.controller!.pos,
												  _.filter(pioneer.room.structures, s => !s.isWalkable));
		if (blockingPos) {
			let structure = blockingPos.lookFor(LOOK_STRUCTURES)[0];
			if (structure) {
				return structure;
			} else {
				log.error(`${this.print}: no structure at blocking pos ${blockingPos.print}! (Why?)`);
			}
		}
	}

	private handlePioneer(pioneer: Zerg): void {
		// Ensure you are in the assigned room
		if (pioneer.room == this.room && !pioneer.pos.isEdge) {
			// Remove any blocking structures preventing claimer from reaching controller
			if (!this.room.my && this.room.structures.length > 0) {
				let dismantleTarget = this.findStructureBlockingController(pioneer);
				if (dismantleTarget) {
					pioneer.task = Tasks.dismantle(dismantleTarget);
					return;
				}
			}
			// Build and recharge
			if (pioneer.carry.energy == 0) {
				pioneer.task = Tasks.recharge();
			} else if (this.spawnSite) {
				pioneer.task = Tasks.build(this.spawnSite);
			}
		} else {
			// pioneer.task = Tasks.goTo(this.pos);
			pioneer.goTo(this.pos, {ensurePath: true, avoidSK: true});
		}
	}

	run() {
		this.autoRun(this.pioneers, pioneer => this.handlePioneer(pioneer));
	}
}

