// Wrapper for task require statements.
// Example:
// var roles = require('roles');
// var role = roles('upgrader');

var createRoleInstance = function (roleName) {
    try {
        var RoleClass = require('role_' + roleName);
        var roleInstance = new RoleClass;
        return roleInstance;
    } catch (e) {
        console.log(e);
        return null;
    }
};

module.exports = createRoleInstance;