var roles = {
    harvester: require('role_harvester'),
    builder: require('role_builder'),
    upgrader: require('role_upgrader')
};

Creep.prototype.role = function() {
    return this.memory.role;
};

Creep.prototype.doRole = function() {
    roles[this.role()].run(this);
};