RoomVisual.prototype.multitext = function(textArray, x, starty, fontSize, style) {
    // console.log(textArray);
    if (textArray == null) {
        return null;
    }
    var y = starty;
    for (line of textArray) {
        new RoomVisual().text(line, x, y, style);
        y += fontSize;
    }
    return y; // returns vertical position of last line
};