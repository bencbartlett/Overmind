import {Overlord} from '../Overlord';
import {Zerg} from '../../zerg/_Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';
import {rechargeObjectType} from '../core/worker';
import {maxBy, minMax} from '../../utilities/utils';
import {isResource} from '../../declarations/typeGuards';

const PioneerSetup = new CreepSetup('pioneer', {
	pattern  : [WORK, CARRY, MOVE, MOVE],
	sizeLimit: Infinity,
});

@profile
export class PioneerOverlord extends Overlord {

	rechargeObjects: rechargeObjectType[];
	pioneers: Zerg[];
	spawnSite: ConstructionSite | undefined;

	constructor(directive: Directive, priority = OverlordPriority.realTime.pioneer) {
		super(directive, 'pioneer', priority);
		this.rechargeObjects = [];
		this.pioneers = this.zerg(PioneerSetup.role);
		this.spawnSite = this.room ? _.filter(this.room.constructionSites,
											  s => s.structureType == STRUCTURE_SPAWN)[0] : undefined;
	}

	init() {
		this.wishlist(4, PioneerSetup);
	}

	private rechargeActions(pioneer: Zerg) {
		// Calculate recharge objects if needed (can't be placed in constructor because instantiation order
		if (this.rechargeObjects.length == 0) {
			let rechargeObjects = _.compact([...pioneer.overlord!.room!.storageUnits,
											 ...(pioneer.overlord!.room!.drops[RESOURCE_ENERGY] || []),
											 ...pioneer.overlord!.room!.tombstones]) as rechargeObjectType[];
			this.rechargeObjects = _.filter(rechargeObjects, obj => isResource(obj) ? obj.amount > 0 : obj.energy > 0);
		}
		// Choose the target to maximize your energy gain subject to other targeting workers
		let target = maxBy(this.rechargeObjects, function (obj) {
			let amount = isResource(obj) ? obj.amount : obj.energy;
			let otherTargetingPioneers = _.map(obj.targetedBy, name => Game.zerg[name]);
			let resourceOutflux = _.sum(_.map(otherTargetingPioneers,
											  other => other.carryCapacity - _.sum(other.carry)));
			amount = minMax(amount - resourceOutflux, 0, pioneer.carryCapacity);
			return amount / (pioneer.pos.getMultiRoomRangeTo(obj.pos) + 1);
		});
		if (target) {
			if (isResource(target)) {
				pioneer.task = Tasks.pickup(target);
			} else {
				pioneer.task = Tasks.withdraw(target);
			}
		} else {
			// Harvest from a source if there is no recharge target available
			let availableSources = _.filter(pioneer.room.sources,
											s => s.energy > 0 && s.pos.availableNeighbors().length > 0);
			let target = pioneer.pos.findClosestByMultiRoomRange(availableSources);
			if (target) pioneer.task = Tasks.harvest(target);
		}
	}

	private handlePioneer(pioneer: Zerg): void {
		// Ensure you are in the assigned room
		if (pioneer.room == this.room && !pioneer.pos.isEdge) {
			if (pioneer.carry.energy == 0) {
				this.rechargeActions(pioneer);
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

