import {Contract_TiggaTerritoryAgreement} from './contractInstances/TiggaTerritory';


// List of all contracts to run each tick. Note that contracts do not run unless MY_USERNAME == "Muon".
// Change this in Overmind.ts to run contracts if you are not me.
export var AllContracts = [
	new Contract_TiggaTerritoryAgreement(),
];