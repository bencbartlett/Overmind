// Terminal brain - executes market orders to maintain an equilibrium amount of resources

class TerminalBrain {
    constructor(roomName) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.terminal = this.room.terminal || null;
        this.settings = require('settings_terminal');
    }

    calculateShortages() {
        if (Game.market.credits < reserveCredits) {
            return null;
        }
        var toBuy = {};
        for (let mineral in this.settings.resourceAmounts) {
            if (mineral == RESOURCE_ENERGY) {
                continue;
            }
            let amount = (this.terminal.store[mineral] || 0);
            if (amount < this.settings.resourceAmounts[mineral]) {
                toBuy[mineral] = this.settings.resourceAmounts[mineral] - amount;
            }
        }
        return toBuy;
    }

    buyShortages() {
        var toBuy = this.calculateShortages();
        if (!toBuy) {
            return null;
        }
        for (let mineral in toBuy) {

        }
    }
}