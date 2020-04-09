// Creep properties ====================================================================================================

// Boosting logic ------------------------------------------------------------------------------------------------------

Object.defineProperty(Creep.prototype, 'boosts', {
	get() {
		if (!this._boosts) {
			this._boosts = _.compact(_.unique(_.map(this.body as BodyPartDefinition[], bodyPart => bodyPart.boost)));
		}
		return this._boosts;
	},
	configurable: true,
});

Object.defineProperty(Creep.prototype, 'boostCounts', {
	get() {
		if (!this._boostCounts) {
			this._boostCounts = _.countBy(this.body as BodyPartDefinition[], bodyPart => bodyPart.boost);
		}
		return this._boostCounts;
	},
	configurable: true,
});

Object.defineProperty(Creep.prototype, 'approxMoveSpeed', {
	get() {
		if (this._moveSpeed == undefined) {
			const movePower = _.sum(this.body, (part: BodyPartDefinition) => {
				if (part.type == MOVE && part.boost) {
					return BOOSTS.move[<'ZO' | 'ZHO2' | 'XZHO2'>part.boost].fatigue;
				} else {
					return 0;
				}
			});
			const nonMoveParts = _.sum(this.body, (part: BodyPartDefinition) => part.type != MOVE ? 1 : 0);
			this._moveSpeed = Math.max(movePower / nonMoveParts, 1); // if nonMoveParts == 0, this will be Infinity -> 1
		}
		return this._moveSpeed;
	},
	configurable: true,
});

Object.defineProperty(Creep.prototype, 'inRampart', {
	get() {
		return !!this.pos.lookForStructure(STRUCTURE_RAMPART); // this assumes hostile creeps can't stand in my ramparts
	},
	configurable: true,
});
