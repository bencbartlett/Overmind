// Creep properties ====================================================================================================

// Boosting logic ------------------------------------------------------------------------------------------------------

Object.defineProperty(Creep.prototype, 'boosts', {
	get(this: Creep) {
		if (!this._boosts) {
			this._boosts = _.compact(_.unique(_.map(this.body, bodyPart => <ResourceConstant>bodyPart.boost)));
		}
		return this._boosts;
	},
	configurable: true,
});

Object.defineProperty(Creep.prototype, 'boostCounts', {
	get(this: Creep) {
		if (!this._boostCounts) {
			this._boostCounts = _.countBy(this.body, bodyPart => bodyPart.boost);
		}
		return this._boostCounts;
	},
	configurable: true,
});

Object.defineProperty(Creep.prototype, 'approxMoveSpeed', {
	get(this: Creep) {
		if (this._moveSpeed == undefined) {
			const movePower = _.sum(this.body, (part) => {
				if (part.type == MOVE && part.boost) {
					return BOOSTS.move[part.boost].fatigue;
				} else {
					return 0;
				}
			});
			const nonMoveParts = _.sum(this.body, (part) => part.type != MOVE ? 1 : 0);
			this._moveSpeed = Math.max(movePower / nonMoveParts, 1); // if nonMoveParts == 0, this will be Infinity -> 1
		}
		return this._moveSpeed;
	},
	configurable: true,
});

Object.defineProperty(Creep.prototype, 'inRampart', {
	get(this: Creep) {
		return !!this.pos.lookForStructure(STRUCTURE_RAMPART); // this assumes hostile creeps can't stand in my ramparts
	},
	configurable: true,
});

// Permanently cached properties
PERMACACHE.bodypartCounts = PERMACACHE.bodypartCounts || {};
Object.defineProperty(Creep.prototype, 'bodypartCounts', {
	get(this: Creep) {
		if (PERMACACHE.bodypartCounts[this.id] === undefined) {
			PERMACACHE.bodypartCounts[this.id] = _.countBy(this.body, (part: BodyPartDefinition) => part.type);
			_.defaults(PERMACACHE.bodypartCounts[this.id], {
				[MOVE]         : 0,
				[WORK]         : 0,
				[CARRY]        : 0,
				[ATTACK]       : 0,
				[RANGED_ATTACK]: 0,
				[TOUGH]        : 0,
				[HEAL]         : 0,
				[CLAIM]        : 0,
			});
		}
		return PERMACACHE.bodypartCounts[this.id];
	},
	configurable: true,
});

PERMACACHE.isPlayer = PERMACACHE.isPlayer || {};
Object.defineProperty(Creep.prototype, 'isPlayer', {
	get(this: Creep) {
		if (PERMACACHE.isPlayer[this.id] === undefined) {
			PERMACACHE.isPlayer[this.id] = this.owner.username != 'Invader' &&
										  this.owner.username != 'Source Keeper' &&
										  this.owner.username != 'Screeps';
		}
		return PERMACACHE.isPlayer[this.id];
	},
	configurable: true,
});




