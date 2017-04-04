var flagCodes = require('map_flag_codes');

Object.defineProperty(StructureLink.prototype, 'refillThis', { // should the lab be loaded or unloaded?
    get () {
        return _.filter(this.pos.lookFor(LOOK_FLAGS), flagCodes.industry.refillThis.filter).length > 0
    },
});