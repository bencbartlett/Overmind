// Wrapper for task require statements.
// Example:
// var Task = require('tasksWrapper');
// var task = Task.repair;

var createTaskInstance = function (taskName) { // returns a new instance of a task
    var TaskClass = require('task_' + taskName);
    return new TaskClass;
};

var tasksWrapper = new Proxy(createTaskInstance, { // this allows you to do task.build instead of tasks('build')
    get: function(instancer, taskType) {
        return instancer(taskType);
    }
});

module.exports = tasksWrapper;