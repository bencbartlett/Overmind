// Container prototypes

Object.defineProperty(StructureContainer.prototype, 'miningFlag', {
    get: function () {
        return this.pos.findInRange(FIND_FLAGS, 2, {
            filter: flag => require('map_flag_codes').industry.remoteMine.filter
        })[0];
    }
});

// Estimated amount of energy a hauler leaving storage now would see when it gets to the container
Object.defineProperty(StructureContainer.prototype, 'predictedEnergyOnArrival', {
    get: function () {
        let predictedEnergy = this.store[RESOURCE_ENERGY];
        let targetingCreeps = _.map(this.targetedBy, name => Game.creeps[name]);
        for (let creep of targetingCreeps) {
            predictedEnergy -= creep.carryCapacity;
        }
        predictedEnergy += (3000 / 300) * this.miningFlag.pathLengthToAssignedRoomStorage;
        return predictedEnergy;
    }
});