var rolesMap = {
    harvester: require('role_harvester'),
    miner: require('role_miner'),
    supplier: require('role_supplier'),
    builder: require('role_builder'),
    upgrader: require('role_upgrader'),
    repairer: require('role_repairer'),
    meleeAttacker: require('role_meleeAttacker'),
    healer: require('role_healer')
};

module.exports = rolesMap;