String.prototype.padRight = function(length: number, char = ' '): string {
	return this + char.repeat(Math.max(length - this.length, 0));
};

String.prototype.padLeft = function(length: number, char = ' '): string {
	return char.repeat(Math.max(length - this.length, 0)) + this;
};

Number.prototype.toPercent = function(decimals = 0): string {
	return (this * 100).toFixed(decimals) + '%';
};

Number.prototype.truncate = function(decimals: number): number {
	const re = new RegExp('(\\d+\\.\\d{' + decimals + '})(\\d)'),
		m  = this.toString().match(re);
	return m ? parseFloat(m[1]) : this.valueOf();
};

Object.defineProperty(ConstructionSite.prototype, 'isWalkable', {
	get() {
		return this.structureType == STRUCTURE_ROAD ||
			   this.structureType == STRUCTURE_CONTAINER ||
			   this.structureType == STRUCTURE_RAMPART;
	},
	configurable: true,
});
