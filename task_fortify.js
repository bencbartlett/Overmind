var Task = require('Task');
var task = new Task('fortify'); // create new task from template
// Settings
task.maxPerTarget = 1;
task.targetRange = 3;
task.moveColor = 'green';
// Overwrite base methods
task.isValidTask = function () {
    return (task.creep.carry.energy > 0);
};
task.isValidTarget = function () {
    var target = task.target;
    var maxHP = task.creep.room.brain.settings.fortifyLevel;
    return (target != null && target.hits && target.hits < maxHP);
};
task.work = function () {
    return task.creep.repair(task.target);
};

module.exports = task;