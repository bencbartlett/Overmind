var roles = require('roles');

var industryFlagActions = {
    remoteMine: function (flag, brain) { // remotely setup and mine an outpost
        function handleRemoteMiners(flag, brain) {
            let assignedMiners = _.filter(flag.assignedCreeps,
                                          creep => creep.memory.role == 'miner' &&
                                                   creep.ticksToLive > creep.memory.data.replaceAt);
            let remoteMinersPerSource = brain.settings.minersPerSource;
            if (assignedMiners.length < brain.settings.minersPerSource) {
                return roles('miner').create(brain.spawn, {
                    assignment: flag
                });
            } else {
                return null;
            }
        }

        function handleRemoteHaulers(flag, brain) {
            if (brain.room.storage != undefined) { // haulers are only built once a room has storage
                let assignedHaulers = _.filter(flag.assignedCreeps,
                                               creep => creep.memory.role == 'hauler');
                // remote haulers should only be spawned for nearly complete (reserved) rooms
                let numConstructionSites = 0;
                if (flag.room) {
                    numConstructionSites = flag.room.find(FIND_MY_CONSTRUCTION_SITES).length;
                }
                var [haulerSize, numHaulers] = brain.calculateHaulerRequirements(flag, true);
                if (assignedHaulers.length < numHaulers && numConstructionSites < 3) {
                    return roles('hauler').create(brain.spawn, {
                        assignment: flag,
                        workRoom: brain.room.name,
                        patternRepetitionLimit: haulerSize
                    });
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }

        return handleRemoteMiners(flag, brain) || handleRemoteHaulers(flag, brain);
    }
};

module.exports = industryFlagActions;