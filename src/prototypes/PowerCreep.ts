// PowerCreep properties ===============================================================================================

Object.defineProperty(PowerCreep.prototype, 'body', {
	get() {
		return [];
	},
	configurable: true,
});

Object.defineProperty(PowerCreep.prototype, 'getActiveBodyparts', {
	get() {
		return 0;
	},
	configurable: true,
});

// Boosting logic ------------------------------------------------------------------------------------------------------

Object.defineProperty(PowerCreep.prototype, 'boosts', {
	get() {
		return [];
	},
	configurable: true,
});
