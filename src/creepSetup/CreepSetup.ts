import {profile} from '../lib/Profiler/Profiler';

export interface bodyOptions {
	pattern: BodyPartConstant[];
	sizeLimit: number;
	prefix: BodyPartConstant[];
	suffix: BodyPartConstant[];
	proportionalPrefixSuffix: boolean;
	ordered: boolean;
}

@profile
export class CreepSetup {
	role: string;								// Name of the role
	body: {
		pattern: BodyPartConstant[];				// body pattern to be repeated
		sizeLimit: number;						// maximum number of unit repetitions to make body
		prefix: BodyPartConstant[];				// stuff at beginning of body
		suffix: BodyPartConstant[];				// stuff at end of body
		proportionalPrefixSuffix: boolean;		// (?) prefix/suffix scale with body size
		ordered: boolean;						// (?) assemble as WORK WORK MOVE MOVE instead of WORK MOVE WORK MOVE
	};

	constructor(roleName: string, bodySettings = {}) {
		this.role = roleName;
		// Defaults for a creep setup
		_.defaults(bodySettings, {
			pattern                 : [],
			sizeLimit               : Infinity,
			prefix                  : [],
			suffix                  : [],
			proportionalPrefixSuffix: false,
			ordered                 : true,
		});
		this.body = bodySettings;
	}

	/* The cost of a single repetition of the basic bodyPattern for this role */
	get bodyPatternCost(): number {
		return this.bodyCost(this.body.pattern);
	}

	/* Return the cost of an entire array of body parts */
	bodyCost(bodyArray: string[]): number {
		var partCosts: { [type: string]: number } = {
			move         : 50,
			work         : 100,
			carry        : 50,
			attack       : 80,
			ranged_attack: 150,
			heal         : 250,
			claim        : 600,
			tough        : 10,
		};
		var cost = 0;
		for (let part of bodyArray) {
			cost += partCosts[part];
		}
		return cost;
	};

	/* Generate the largest body of a given pattern that is producable from a room,
	 * subject to limitations from maxRepeats */
	generateBody(availableEnergy: number): BodyPartConstant[] {
		let patternCost, patternLength, numRepeats;
		let prefix = this.body.prefix;
		let suffix = this.body.suffix;
		let proportionalPrefixSuffix = this.body.proportionalPrefixSuffix;
		let body: BodyPartConstant[] = [];
		// calculate repetitions
		if (proportionalPrefixSuffix) { // if prefix and suffix are to be kept proportional to body size
			patternCost = this.bodyCost(prefix) + this.bodyCost(this.body.pattern) + this.bodyCost(suffix);
			patternLength = prefix.length + this.body.pattern.length + suffix.length;
			let energyLimit = Math.floor(availableEnergy / patternCost); // maximum number of repeats room can produce
			let maxPartLimit = Math.floor(50 / patternLength); // maximum number of repetitions resulting in <50 parts
			numRepeats = Math.min(energyLimit, maxPartLimit, this.body.sizeLimit);
		} else { // if prefix and suffix don't scale
			let extraCost = this.bodyCost(prefix) + this.bodyCost(suffix);
			patternCost = this.bodyCost(this.body.pattern);
			patternLength = this.body.pattern.length;
			let energyLimit = Math.floor((availableEnergy - extraCost) / patternCost);
			let maxPartLimit = Math.floor((50 - prefix.length - suffix.length) / patternLength);
			numRepeats = Math.min(energyLimit, maxPartLimit, this.body.sizeLimit);
		}
		// build the body
		if (proportionalPrefixSuffix) { // add the prefix
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(prefix);
			}
		} else {
			body = body.concat(prefix);
		}

		if (this.body.ordered) { // repeated body pattern
			for (let part of this.body.pattern) {
				for (let i = 0; i < numRepeats; i++) {
					body.push(part);
				}
			}
		} else {
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(this.body.pattern);
			}
		}

		if (proportionalPrefixSuffix) { // add the suffix
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(suffix);
			}
		} else {
			body = body.concat(suffix);
		}
		// return it
		return body;
	}

	// /* Generate (but not spawn) the largest creep possible, returns the creep as an object */
	// generateLargestCreep(overseer: IOverseer): protoCreep {
	// 	let creepBody: BodyPartConstant[];
	// 	if (colony.incubator) { // if you're being incubated, build as big a creep as you want
	// 		creepBody = this.generateBody(overseer.colony.incubator.room.energyCapacityAvailable);
	// 	} else { // otherwise limit yourself to actual energy constraints
	// 		creepBody = this.generateBody(overseer.colony.room.energyCapacityAvailable);
	// 	}
	// 	let protoCreep: protoCreep = { 									// object to add to spawner queue
	// 		body  : creepBody, 											// body array
	// 		name  : this.name, 											// name of the creep - gets modified by hatchery
	// 		memory: { 													// memory to initialize with
	// 			colony  : overseer.colony.name, 							// name of the colony the creep is assigned to
	// 			overseer: overseer.name,							// name of the overseer running this creep
	// 			role    : this.name,								// role of the creep
	// 			task    : null, 									// task the creep is performing
	// 			data    : { 										// rarely-changed data about the creep
	// 				origin   : '',										// where it was spawned, filled in at spawn time
	// 				replaceAt: 0, 										// when it should be replaced
	// 				boosts   : {} 										// keeps track of what boosts creep has/needs
	// 			},
	// 			roleData: {}, 										// empty role data object
	// 		},
	// 	};
	// 	return protoCreep;
	// }
	//
	// /* Create a protocreep, modify it as needed, and return the object. Does not spawn the creep. */
	// create(overseer: IOverseer): protoCreep {
	// 	return this.generateLargestCreep(overseer);
	// }
}
