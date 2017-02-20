// Wrapper for task require statements.
// Example:
// var tasks = require('tasks');
// var task = tasks('repair');

module.exports = function (taskName) {
    return require('task_' + taskName);
};