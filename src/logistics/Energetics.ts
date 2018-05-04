// Energetics manager; makes high-level decisions based on energy amounts

import {Colony, ColonyStage} from '../Colony';

export class Energetics {

	static settings = {
		storage : {
			total: {
				cap: STORAGE_CAPACITY - 50000
			}
		},
		terminal: {
			energy: {
				sendSize    : 25000,	// Send energy in chunks of this size
				inThreshold : 50000, 	// Terminals with < this amount of energy in room actively store energy
				outThreshold: 150000,	// Terminals with more than this amount of energy in store send elsewhere
				equilibrium : 100000, 	// Try to maintain this amount; should be energyInThreshold + 2*energySendSize
			},
		},
	};

	static lowPowerMode(colony: Colony): boolean {
		if (colony.stage == ColonyStage.Adult) {
			if (_.sum(colony.storage!.store) > this.settings.storage.total.cap &&
				colony.terminal && _.sum(colony.terminal.store) > colony.terminal.storeCapacity - 25000) {
				return true;
			}
		}
		return false;
	}

}