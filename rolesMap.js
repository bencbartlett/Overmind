// Prioritized roles map that also acts as spawning instructions for spawner

var rolesMap = { // TODO: replace 'amount' with function giving amount automatically
    harvester: {
        behavior: require('role_harvester'),
        amount: 0
    },
    miner: {
        behavior: require('role_miner'),
        amount: 3
    },
    supplier: {
        behavior: require('role_supplier'),
        amount: 2
    },
    repairer: {
        behavior: require('role_repairer'),
        amount: 10
    },
    builder: {
        behavior: require('role_builder'),
        amount: 0
    },
    upgrader: {
        behavior: require('role_upgrader'),
        amount: 1
    },
    remoteMiner: {
        behavior: require('role_remoteMiner'),
        amount: 0
    },
    hauler: {
        behavior: require('role_hauler'),
        amount: 0
    },
    guard: {
        behavior: require('role_guard'),
        amount: 0
    },
    reserver: {
        behavior: require('role_reserver'),
        amount: 0
    },
    healer: {
        behavior: require('role_healer'),
        amount: 0
    },
    meleeAttacker: {
        behavior:  require('role_meleeAttacker'),
        amount: 0
    }
};

module.exports = rolesMap;