// Creep properties ====================================================================================================

// Boosting logic ------------------------------------------------------------------------------------------------------

Object.defineProperties(Creep.prototype, {
	boosts: {
		get() {
			if (!this._boosts) {
				this._boosts = _.compact(_.unique(_.map(this.body as BodyPartDefinition[],
														bodyPart => bodyPart.boost))) as _ResourceConstantSansEnergy[];
			}
			return this._boosts;
			// return _.compact(_.unique(_.map(this.body as BodyPartDefinition[],
			// 								bodyPart => bodyPart.boost))) as _ResourceConstantSansEnergy[];
		},
	},

	boostCounts: {
		get() {
			if (!this._boostCounts) {
				this._boostCounts = _.countBy(this.body as BodyPartDefinition[], bodyPart => bodyPart.boost);
			}
			return this._boostCounts;
			// return _.countBy(this.body as BodyPartDefinition[], bodyPart => bodyPart.boost);
		}
	},
});
