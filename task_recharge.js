var Task = require('Task');
var task = new Task('recharge'); // create new task from template
// Settings
task.moveColor = 'blue';
// Overwrite base methods
task.isValidTask = function () {
    var creep = task.creep;
    return (creep.carry.energy < creep.carryCapacity);
};
task.isValidTarget = function () {
    var target = task.target;
    return (target != null && target.store && target.store[RESOURCE_ENERGY] > 0);
};
task.work = function () {
    return task.creep.withdraw(task.target, RESOURCE_ENERGY);
};

module.exports = task;