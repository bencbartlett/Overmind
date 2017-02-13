// Prioritized roles map that also acts as spawning instructions for spawner

var rolesMap = {
    harvester: {
        behavior: require('role_harvester'),
        amount: 0
    },
    miner: {
        behavior: require('role_miner'),
        amount: 4
    },
    supplier: {
        behavior: require('role_supplier'),
        amount: 2
    },
    repairer: {
        behavior: require('role_repairer'),
        amount: 2
    },
    builder: {
        behavior: require('role_builder'),
        amount: 1
    },
    upgrader: {
        behavior: require('role_upgrader'),
        amount: 2
    },
    remoteMiner: {
        behavior: require('role_remoteMiner'),
        amount: 2
    },
    hauler: {
        behavior: require('role_hauler'),
        amount: 2
    },
    reserver: {
        behavior: require('role_reserver'),
        amount: 1
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