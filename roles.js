// Wrapper for task require statements.
// Example:
// var roles = require('roles');
// var role = roles('upgrader');

var createRoleInstance = function (roleName) {
    var RoleClass = require('role_' + roleName);
    var roleInstance = new RoleClass;
    return roleInstance;
};

module.exports = createRoleInstance;