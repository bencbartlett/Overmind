var Task = require('Task');
var task = new Task('build'); // create new task from template
// Settings
task.maxPerTarget = 3;
task.targetRange = 3;
task.moveColor = 'yellow';
// Overwrite base methods
task.isValidTask = function () {
    return (task.creep.carry.energy > 0);
};
task.isValidTarget = function () {
    var target = task.target;
    return (target != null && target.my && target.progress < target.progressTotal);
};
task.work = function () {
    return task.creep.build(task.target);
};

module.exports = task;