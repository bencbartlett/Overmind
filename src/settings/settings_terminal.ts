// Desired equilibrium resource amounts go here
let resourceAmounts: { [resourceType: string]: number } = {};
resourceAmounts[RESOURCE_ENERGY] = 50000;
resourceAmounts[RESOURCE_CATALYZED_GHODIUM_ACID] = 1000;
resourceAmounts[RESOURCE_CATALYZED_GHODIUM_ALKALIDE] = 500;
resourceAmounts[RESOURCE_CATALYZED_UTRIUM_ACID] = 500;
resourceAmounts[RESOURCE_CATALYZED_ZYNTHIUM_ACID] = 500;
resourceAmounts[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] = 500;

// Maximum values to buy things at go here
let maxBuyPrice: { [resourceType: string]: number } = {};
maxBuyPrice[RESOURCE_ENERGY] = 0; // never buy energy...
maxBuyPrice[RESOURCE_CATALYZED_GHODIUM_ACID] = 4;
maxBuyPrice[RESOURCE_CATALYZED_GHODIUM_ALKALIDE] = 4;
maxBuyPrice[RESOURCE_CATALYZED_UTRIUM_ACID] = 4;
maxBuyPrice[RESOURCE_CATALYZED_ZYNTHIUM_ACID] = 4;
maxBuyPrice[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] = 4;

// Effective market prices go here // TODO: automatically calculate this?
let avgPrice: { [resourceType: string]: number } = {};
avgPrice[RESOURCE_ENERGY] = 0.01;

export var terminalSettings = {
	resourceAmounts: resourceAmounts,
	maxBuyPrice    : maxBuyPrice,
	avgPrice       : avgPrice,
};
