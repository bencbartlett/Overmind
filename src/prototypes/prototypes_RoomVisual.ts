RoomVisual.prototype.multitext = function (textArray, x, starty, fontSize, style) {
	var y = starty;
	for (let line of textArray) {
		new RoomVisual().text(line, x, y, style);
		y += fontSize;
	}
	return y; // returns vertical position of last line
};

