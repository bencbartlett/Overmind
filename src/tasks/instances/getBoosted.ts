import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {BOOST_PARTS} from '../../resources/map_resources';
import {Task} from '../Task';

export type getBoostedTargetType = StructureLab;
export const getBoostedTaskName = 'getBoosted';

export const MIN_LIFETIME_FOR_BOOST = 0.85;

@profile
export class TaskGetBoosted extends Task {

	target: getBoostedTargetType;

	data: {
		resourceType: ResourceConstant;
		amount: number | undefined;
	};

	constructor(target: getBoostedTargetType,
				boostType: ResourceConstant,
				partCount?: number,
				options = {} as TaskOptions) {
		super(getBoostedTaskName, target, options);
		// Settings
		this.data.resourceType = boostType;
		this.data.amount = partCount;
	}

	isValidTask() {
		const lifetime = _.any(this.creep.body, part => part.type == CLAIM) ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
		if (this.creep.ticksToLive && this.creep.ticksToLive < MIN_LIFETIME_FOR_BOOST * lifetime) {
			return false; // timeout after this amount of lifespan has passed
		}
		// else if (BOOST_PARTS[this.data.resourceType] == MOVE &&
		// this.creep.getActiveBodyparts(BOOST_PARTS[this.data.resourceType]) >= this.creep.body.length / 2) {
		// 	Game.notify(`Bad boosting of move on creep ${this.creep}, invalid task.`);
		// 	return false;
		// }
		const partCount = (this.data.amount || this.creep.getActiveBodyparts(BOOST_PARTS[this.data.resourceType]));
		return (this.creep.boostCounts[this.data.resourceType] || 0) < partCount;
	}

	isValidTarget() {
		const partCount = (this.data.amount || this.creep.getActiveBodyparts(BOOST_PARTS[this.data.resourceType]));
		return this.target && this.target.mineralType == this.data.resourceType &&
			   this.target.mineralAmount >= LAB_BOOST_MINERAL * partCount &&
			   this.target.energy >= LAB_BOOST_ENERGY * partCount;
	}

	work() {
		if (this.creep.spawning) {
			return ERR_INVALID_TARGET;
		}
		const partCount = (this.data.amount || this.creep.getActiveBodyparts(BOOST_PARTS[this.data.resourceType]));
		// if (BOOST_PARTS[this.data.resourceType] == MOVE && partCount >= this.creep.body.length / 2){
		// 	Game.notify(`Bad boosting of move on creep ${this.creep}, exiting work.`);
		// 	return ERR_INVALID_TARGET;
		// }
		if (this.target.mineralType == this.data.resourceType &&
			this.target.mineralAmount >= LAB_BOOST_MINERAL * partCount &&
			this.target.energy >= LAB_BOOST_ENERGY * partCount) {
			const result = this.target.boostCreep(deref(this._creep.name) as Creep, this.data.amount);
			log.info(`Lab@${this.target.pos.print}: boosting creep ${this.creep.print} with ${this.target.mineralType}!`
					 + ` Response: ${result}`);
			return result;
		} else {
			return ERR_NOT_FOUND;
		}
	}
}


