// Wrapper for task require statements.
// Example:
// var tasks = require('tasks');
// var task = tasks('repair');

var createTaskInstance = function (taskName) {
    var TaskClass = require('task_' + taskName);
    var taskInstance = new TaskClass;
    return taskInstance;
};

module.exports = createTaskInstance;