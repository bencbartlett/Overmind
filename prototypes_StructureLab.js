var flagCodes = require('map_flag_codes');

Object.defineProperty(StructureLab.prototype, 'assignedMineralType', {
    get () {
        let flag = _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.minerals.filter)[0];
        if (flag) {
            let mineralType = flag.memory.mineralType;
            if (mineralType) {
                return mineralType;
            }
        }
        return null;
    }
});

Object.defineProperty(StructureLab.prototype, 'IO', { // should the lab be loaded or unloaded?
    get () {
        let flag = _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.minerals.filter)[0];
        if (flag) {
            return flag.memory.IO;
        }
        return null;
    },
});

Object.defineProperty(StructureLab.prototype, 'maxAmount', { // should the lab be loaded or unloaded?
    get () {
        let flag = _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.minerals.filter)[0];
        if (flag) {
            return flag.memory.maxAmount || this.mineralCapacity;
        }
        return null;
    },
});