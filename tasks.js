// Wrapper for task require statements.
// Example:
// var tasks = require('tasks');
// var task = tasks('repair');

var createTaskInstance = function (taskName) {
    try {
        var TaskClass = require('task_' + taskName);
        var taskInstance = new TaskClass;
        return taskInstance;
    } catch (e) {
        console.log(e);
        return null;
    }
};

module.exports = createTaskInstance;