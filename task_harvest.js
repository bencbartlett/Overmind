var Task = require('Task');
var task = new Task('harvest'); // create new task from template
module.exports = task;
// Settings
task.moveColor = 'blue';
// Overwrite base methods
task.isValidTask = function () {
    var creep = task.creep;
    return (creep.carry.energy < creep.carryCapacity);
};
task.isValidTarget = function () {
    var target = task.target;
    return (target != null && target.energy != null && target.energy > 0);
};
task.work = function () {
    return task.creep.harvest(task.target);
};

