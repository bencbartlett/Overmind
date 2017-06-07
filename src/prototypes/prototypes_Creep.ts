// Creep prototypes

import {Traveler, TravelToOptions} from '../lib/Traveler';

// Creep properties ====================================================================================================

Creep.prototype.getBodyparts = function (partType) {
	return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
};

Object.defineProperty(Creep.prototype, 'colony', { // retrieve the colony object of the creep
	get: function () {
		return Overmind.Colonies[this.memory.colony];
	},
	set: function (newColony) {
		this.memory.colony = newColony.name;
	},
});

Object.defineProperty(Creep.prototype, 'lifetime', { // creep lifetime; 1500 unless claimer, then 500
	get: function () {
		if (_.map(this.body, (part: BodyPartDefinition) => part.type).includes(CLAIM)) {
			return 500;
		} else {
			return 1500;
		}
	},
});

// const traveler = new Traveler();
// Creep.prototype.travelTo = function (destination: RoomPosition | { pos: RoomPosition }, options?: TravelToOptions) {
// 	if (options) {
// 		return traveler.travelTo(this, destination, options);
// 	} else {
// 		return traveler.travelTo(this, destination);
// 	}
// };
Creep.prototype.travelTo = function(destination: RoomPosition|{pos: RoomPosition}, options?: TravelToOptions) {
	return Traveler.travelTo(this, destination, options);
};
