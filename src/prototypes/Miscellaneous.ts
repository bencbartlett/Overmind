String.prototype.padRight = function(this: string, length: number, char = ' '): string {
	return this + char.repeat(Math.max(length - this.length, 0));
};

String.prototype.padLeft = function(this: string, length: number, char = ' '): string {
	return char.repeat(Math.max(length - this.length, 0)) + this;
};

Number.prototype.toPercent = function(this: number, decimals = 0): string {
	return (this * 100).toFixed(decimals) + '%';
};

Number.prototype.truncate = function(this: number, decimals: number): number {
	const re = new RegExp('(\\d+\\.\\d{' + decimals + '})(\\d)'),
		  m  = this.toString().match(re);
	return m ? parseFloat(m[1]) : this.valueOf();
};

PERMACACHE.structureWalkability = PERMACACHE.structureWalkability || {};
Object.defineProperty(ConstructionSite.prototype, 'isWalkable', {
	get(this: ConstructionSite) {
		if (PERMACACHE.structureWalkability[this.id] === undefined) {
			PERMACACHE.structureWalkability[this.id] = this.structureType == STRUCTURE_ROAD ||
													   this.structureType == STRUCTURE_CONTAINER ||
													   this.structureType == STRUCTURE_RAMPART;
		}
		return PERMACACHE.structureWalkability[this.id];
	},
	configurable: true,
});
