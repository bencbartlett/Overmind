require('constants');
require('prototypes_creep_targeting');
require('prototypes_creep_goTask');

var rolesMap = require('rolesMap');

Creep.prototype.run = function () {
    // TODO: creep need renewal?
    this.doRole();
};

Creep.prototype.doRole = function () {
    rolesMap[this.memory.role].behavior.run(this);
};

Creep.prototype.moveToVisual = function (target, color = '#fff') {
    var visualizePath = true;
    if (visualizePath) {
        var pathStyle = {
            fill: 'transparent',
            stroke: color,
            lineStyle: 'dashed',
            strokeWidth: .15,
            opacity: .3
        };
        return this.moveTo(target, {visualizePathStyle: pathStyle});
    } else {
        return this.moveTo(target);
    }
};

Creep.prototype.isInRoom = function (roomName) {
    return (this.room.name == roomName);
};