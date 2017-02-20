var Task = require('Task');
var task = new Task('repair'); // create new task from template
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
    return (target != null && target.hits && target.hits < target.hitsMax);
};
task.work = function () {
    return task.creep.repair(task.target);
};

module.exports = task;