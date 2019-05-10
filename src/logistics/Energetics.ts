import {Colony, ColonyStage} from '../Colony';

/**
 * Energetics manager; makes high-level decisions based on energy amounts
 */
export class Energetics {

	static settings = {
		storage : {
			total : {
				cap      : STORAGE_CAPACITY - 100000,
				tolerance: 5000,
			},
			energy: {
				destroyTerminalThreshold: 200000	// won't rebuild terminal until you have this much energy in storage
			}
		},
		terminal: {
			total : {
				cap: TERMINAL_CAPACITY - 50000
			},
			energy: {
				sendSize    : 25000,	// Send energy in chunks of this size
				inThreshold : 25000, 	// Terminals with < this amount of energy in room actively store energy
				outThreshold: 100000,	// Terminals with more than this amount of energy in store send elsewhere
				equilibrium : 50000, 	// Try to maintain this amount; should be energyInThreshold + 2*energySendSize
				tolerance   : 5000,		// Don't care about deviation by less than this amount
				tradeAmount : 10000,	// Buy/sell energy in increments of this amount
			},
		},
	};

	static lowPowerMode(colony: Colony): boolean {
		if (colony.stage == ColonyStage.Adult) {
			if (_.sum(colony.storage!.store) > this.settings.storage.total.cap &&
				colony.terminal && _.sum(colony.terminal.store) > this.settings.terminal.total.cap) {
				return true;
			}
		}
		return false;
	}

}
