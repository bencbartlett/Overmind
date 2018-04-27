// Creep properties ====================================================================================================

// Boosting logic ------------------------------------------------------------------------------------------------------

Object.defineProperties(Creep.prototype, {
	boosts: {
		get() {
			return _.compact(_.unique(_.map(this.body as BodyPartDefinition[],
											bodyPart => bodyPart.boost))) as _ResourceConstantSansEnergy[];
		},
	},

	boostCounts: {
		get() {
			return _.countBy(this.body as BodyPartDefinition[], bodyPart => bodyPart.boost);
		}
	},
});
