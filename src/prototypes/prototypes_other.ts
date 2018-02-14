String.prototype.padRight = function (length: number, char = ' '): string {
	return this + char.repeat(Math.max(length - this.length, 0));
};

String.prototype.padLeft = function (length: number, char = ' '): string {
	return char.repeat(Math.max(length - this.length, 0)) + this;
};