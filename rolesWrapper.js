// Wrapper for task require statements.
// Example:
// var Roles = require('roles');
// var role = Roles.upgrader;

var createRoleInstance = function (roleName) {
    var RoleClass = require('role_' + roleName);
    var roleInstance = new RoleClass;
    return roleInstance;
};

var rolesWrapper = new Proxy(createRoleInstance(), { // this allows you to do task.build instead of tasks('build')
    get: function(instancer, roleType) {
        return instancer(roleType);
    }
});

module.exports = rolesWrapper;