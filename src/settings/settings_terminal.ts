// Terminal settings

// I'm working on overhauling how terminal networks function, but for the time being, this determines the content
// of every terminal across your empire.


// Desired equilibrium resource amounts go here.
// Resources will be bought to achieve this amount if they are sold below a specified price in maxBuyPrice.

let resourceAmounts: { [resourceType: string]: number } = {};
resourceAmounts[RESOURCE_ENERGY] = 50000;
// resourceAmounts[RESOURCE_CATALYZED_GHODIUM_ACID] = 1000;
// resourceAmounts[RESOURCE_CATALYZED_GHODIUM_ALKALIDE] = 500;
// resourceAmounts[RESOURCE_CATALYZED_UTRIUM_ACID] = 500;
// resourceAmounts[RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE] = 500;
// resourceAmounts[RESOURCE_CATALYZED_ZYNTHIUM_ACID] = 500;
// resourceAmounts[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] = 500;

// Maximum price that you will buy resources at go here. Resources you never want to buy should be set to zero.
let maxBuyPrice: { [resourceType: string]: number } = {};
maxBuyPrice.default = 4;			// Default maximum: 4 credits per unit of resource (quite pricey, actually...)
maxBuyPrice[RESOURCE_ENERGY] = 0; 	// Never buy energy

export var terminalSettings = {
	resourceAmounts: resourceAmounts,
	maxBuyPrice    : maxBuyPrice,
};

export var reserveCredits = 10000; // Stop buying stuff after you get down to this many credits

