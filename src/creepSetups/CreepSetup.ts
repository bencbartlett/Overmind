import {Colony} from '../Colony';
import {profile} from '../profiler/decorator';
import {BoostType, BoostTypeBodyparts} from '../resources/map_resources';
import {BodyGeneratorReturn} from './CombatCreepSetup';

export interface BodySetup {
	pattern: BodyPartConstant[];			// body pattern to be repeated
	sizeLimit: number;						// maximum number of unit repetitions to make body
	prefix: BodyPartConstant[];				// stuff at beginning of body
	suffix: BodyPartConstant[];				// stuff at end of body
	proportionalPrefixSuffix: boolean;		// (?) prefix/suffix scale with body size
	ordered: boolean;						// (?) assemble as WORK WORK MOVE MOVE instead of WORK MOVE WORK MOVE
}

/* Return the cost of an entire array of body parts */
export function bodyCost(bodyparts: BodyPartConstant[]): number {
	return _.sum(bodyparts, part => BODYPART_COST[part]);
}

export function patternCost(setup: CreepSetup): number {
	return bodyCost(setup.bodySetup.pattern);
}

/**
 * The CreepSetup class contains methods for flexibly generating creep body arrays when needed for spawning
 */
@profile
export class CreepSetup {

	role: string;
	bodySetup: BodySetup;
	private boosts: BoostType[];
	private cache: { [colonyName: string]: { result: BodyGeneratorReturn, expiration: number } };

	constructor(roleName: string, bodySetup = {}, boosts?: BoostType[]) {
		this.role = roleName;
		// Defaults for a creep setup
		_.defaults(bodySetup, {
			pattern                 : [],
			sizeLimit               : Infinity,
			prefix                  : [],
			suffix                  : [],
			proportionalPrefixSuffix: false,
			ordered                 : true,
		});
		this.bodySetup = bodySetup as BodySetup;
		this.boosts = boosts || [];
		this.cache = {};
	}

	/**
	 * Returns a new CreepSetup instance which is a copy of the existing setup but with boosts applied. This allows
	 * you to easily make boosted versions of the default setups in setups.ts without modifying the original objects.
	 */
	static boosted(setup: CreepSetup, boosts: BoostType[]) {
		return new CreepSetup(setup.role, setup.bodySetup, boosts);
	}

	/**
	 * Generate the body and best boosts for a requested creep
	 */
	create(colony: Colony, useCache = false): BodyGeneratorReturn {
		// If you're allowed to use a cached result (e.g. for estimating wait times), return that
		if (useCache && this.cache[colony.name] && Game.time < this.cache[colony.name].expiration) {
			return this.cache[colony.name].result;
		}

		// Otherwise recompute
		const body = this.generateBody(colony.room.energyCapacityAvailable);
		const bodyCounts = _.countBy(body);

		const boosts: ResourceConstant[] = [];

		if (this.boosts.length > 0 && colony.evolutionChamber) {
			for (const boostType of this.boosts) {
				const numParts = bodyCounts[BoostTypeBodyparts[boostType]];
				const bestBoost = colony.evolutionChamber.bestBoostAvailable(boostType, numParts * LAB_BOOST_MINERAL);
				if (bestBoost) {
					boosts.push(bestBoost);
				}
			}
		}

		const result = {
			body  : body,
			boosts: boosts,
		};
		this.cache[colony.name] = {
			result    : result,
			expiration: Game.time + 20,
		};

		return result;
	}

	/**
	 * Generate the largest body of a given pattern that can be made from a room, subject to limitations from maxRepeats
	 */
	generateBody(availableEnergy: number): BodyPartConstant[] {
		let patternCost, patternLength, numRepeats: number;
		const prefix = this.bodySetup.prefix;
		const suffix = this.bodySetup.suffix;
		let body: BodyPartConstant[] = [];
		// calculate repetitions
		if (this.bodySetup.proportionalPrefixSuffix) { // if prefix and suffix are to be kept proportional to body size
			patternCost = bodyCost(prefix) + bodyCost(this.bodySetup.pattern) + bodyCost(suffix);
			patternLength = prefix.length + this.bodySetup.pattern.length + suffix.length;
			const energyLimit = Math.floor(availableEnergy / patternCost); // max number of repeats room can produce
			const maxPartLimit = Math.floor(MAX_CREEP_SIZE / patternLength); // max repetitions resulting in <50 parts
			numRepeats = Math.min(energyLimit, maxPartLimit, this.bodySetup.sizeLimit);
		} else { // if prefix and suffix don't scale
			const extraCost = bodyCost(prefix) + bodyCost(suffix);
			patternCost = bodyCost(this.bodySetup.pattern);
			patternLength = this.bodySetup.pattern.length;
			const energyLimit = Math.floor((availableEnergy - extraCost) / patternCost);
			const maxPartLimit = Math.floor((MAX_CREEP_SIZE - prefix.length - suffix.length) / patternLength);
			numRepeats = Math.min(energyLimit, maxPartLimit, this.bodySetup.sizeLimit);
		}
		// build the body
		if (this.bodySetup.proportionalPrefixSuffix) { // add the prefix
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(prefix);
			}
		} else {
			body = body.concat(prefix);
		}

		if (this.bodySetup.ordered) { // repeated body pattern
			for (const part of this.bodySetup.pattern) {
				for (let i = 0; i < numRepeats; i++) {
					body.push(part);
				}
			}
		} else {
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(this.bodySetup.pattern);
			}
		}

		if (this.bodySetup.proportionalPrefixSuffix) { // add the suffix
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(suffix);
			}
		} else {
			body = body.concat(suffix);
		}
		// return it
		return body;
	}

	generateMaxedBody() {
		// TODO hardcoded for our current cap with extensions missing
		return this.generateBody(11100);
	}

	/**
	 * Returns the number of parts that a body will have if made from a given colony
	 */
	getBodyPotential(partType: BodyPartConstant, colony: Colony): number {
		// let energyCapacity = Math.max(colony.room.energyCapacityAvailable,
		// 							  colony.incubator ? colony.incubator.room.energyCapacityAvailable : 0);
		let energyCapacity = colony.room.energyCapacityAvailable;
		if (colony.spawnGroup) {
			const colonies = _.compact(_.map(colony.spawnGroup.memory.colonies,
											 name => Overmind.colonies[name])) as Colony[];
			energyCapacity = _.max(_.map(colonies, colony => colony.room.energyCapacityAvailable));
		}
		const body = this.generateBody(energyCapacity);
		return _.filter(body, (part: BodyPartConstant) => part == partType).length;
	}

}
