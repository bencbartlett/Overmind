// Prioritized roles map that also acts as spawning instructions for spawner

var rolesMap = {
    // behavior: creep behavior pattern
    // amount: amount to spawn (DEPRECATED)
    miner: {
        behavior: require('role_miner'),
        amount: 0
    },
    hauler: {
        behavior: require('role_hauler'),
        amount: 0
    },
    supplier: {
        behavior: require('role_supplier'),
        amount: 0
    },
    worker: {
        behavior: require('role_worker'),
        amount: 0
    },
    guard: {
        behavior: require('role_guard'),
        amount: 0
    },
    reserver: {
        behavior: require('role_reserver'),
        amount: 0
    }
};

module.exports = rolesMap;