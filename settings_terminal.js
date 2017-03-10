var terminalSettings = {
    resourceAmounts: {},
    resourceMaxValues: {}
};
// Desired equilibrium resource amounts go here
terminalSettings.resourceAmounts[RESOURCE_ENERGY] = 50000;
terminalSettings.resourceAmounts[RESOURCE_CATALYZED_GHODIUM_ACID] = 5000;
// Maximum values to deal orders at go here
terminalSettings.resourceMaxValues[RESOURCE_ENERGY] = 0; // never buy energy...
terminalSettings.resourceMaxValues[RESOURCE_CATALYZED_GHODIUM_ACID] = 3;

module.exports = terminalSettings;