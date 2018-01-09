import {profile} from '../lib/Profiler/Profiler';

export interface bodyOptions {
	pattern: BodyPartConstant[];			// body pattern to be repeated
	sizeLimit: number;						// maximum number of unit repetitions to make body
	prefix: BodyPartConstant[];				// stuff at beginning of body
	suffix: BodyPartConstant[];				// stuff at end of body
	proportionalPrefixSuffix: boolean;		// (?) prefix/suffix scale with body size
	ordered: boolean;						// (?) assemble as WORK WORK MOVE MOVE instead of WORK MOVE WORK MOVE
}

@profile
export class CreepSetup {
	role: string;
	body: bodyOptions;

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
		this.body = bodySettings as bodyOptions;
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
}
