var terminalSettings = {
    resourceAmounts: {},
    maxBuyPrice: {},
    avgPrice: {}
};
// Desired equilibrium resource amounts go here
terminalSettings.resourceAmounts[RESOURCE_ENERGY] = 50000;
terminalSettings.resourceAmounts[RESOURCE_CATALYZED_GHODIUM_ACID] = 1000;
terminalSettings.resourceAmounts[RESOURCE_CATALYZED_GHODIUM_ALKALIDE] = 500;
terminalSettings.resourceAmounts[RESOURCE_CATALYZED_UTRIUM_ACID] = 500;
terminalSettings.resourceAmounts[RESOURCE_CATALYZED_ZYNTHIUM_ACID] = 500;
terminalSettings.resourceAmounts[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] = 500;
// Maximum values to buy things at go here
terminalSettings.maxBuyPrice[RESOURCE_ENERGY] = 0; // never buy energy...
terminalSettings.maxBuyPrice[RESOURCE_CATALYZED_GHODIUM_ACID] = 4;
terminalSettings.maxBuyPrice[RESOURCE_CATALYZED_GHODIUM_ALKALIDE] = 4;
terminalSettings.maxBuyPrice[RESOURCE_CATALYZED_UTRIUM_ACID] = 4;
terminalSettings.maxBuyPrice[RESOURCE_CATALYZED_ZYNTHIUM_ACID] = 4;
terminalSettings.maxBuyPrice[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] = 4;
// Effective market prices go here // TODO: automatically calculate this?
terminalSettings.avgPrice[RESOURCE_ENERGY] = 0.01;

module.exports = terminalSettings;