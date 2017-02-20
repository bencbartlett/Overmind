var Task = require('Task');
var task = new Task('upgrade'); // create new task from template
// Settings
task.targetRange = 3;
task.moveColor = 'purple';
// Overwrite base methods
task.isValidTask = function () {
    return (task.creep.carry.energy > 0);
};
task.isValidTarget = function () {
    var target = task.target;
    return (target != null && target.structureType == STRUCTURE_CONTROLLER && target.my);
};
task.work = function () {
    return task.creep.upgradeController(task.target);
};

module.exports = task;