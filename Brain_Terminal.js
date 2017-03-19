// Terminal brain - executes market orders to maintain an equilibrium amount of resources

class TerminalBrain {
    constructor(roomName) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.terminal = Game.rooms[roomName].terminal;
        this.settings = require('settings_terminal');
    }

    effectivePricePerUnit(order) {
        let transferCost = Game.market.calcTransactionCost(1000, this.room.name, order.roomName) / 1000;
        let expense = order.price + transferCost * this.settings.avgPrice[RESOURCE_ENERGY];
        return order.price + transferCost;
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

    buyShortages() { // buy needed minerals from the market for the best price, including energy
        var toBuy = this.calculateShortages();
        if (toBuy == {}) { // nothing to buy
            return null;
        }
        for (let mineral in toBuy) {
            if (mineral == RESOURCE_ENERGY) {
                continue;
            }
            let relevantOrders = Game.market.getAllOrders(order => order.type == ORDER_SELL &&
                                                                   order.resourceType == mineral &&
                                                                   order.remainingAmount > 100);
            let bestOrder = null;
            let bestCost = Infinity;
            for (let order of relevantOrders) {
                let cost = this.effectivePricePerUnit(order);
                if (cost < bestCost) {
                    bestOrder = order;
                    bestCost = cost;
                    // console.log(mineral, "from", bestOrder.roomName, "for", bestOrder.price, "credits/unit and",
                    //             Game.market.calcTransactionCost(1000, this.room.name, bestOrder.roomName) / 1000,
                    //             "energy/unit");
                }
            }
            if (bestOrder && this.effectivePricePerUnit(bestOrder) < this.settings.maxBuyPrice[mineral]) {
                let amount = Math.min(bestOrder.remainingAmount, toBuy[mineral]);
                let response = Game.market.deal(bestOrder.id, amount, this.room.name);
                console.log(this.name + ": bought", amount, mineral, "from", bestOrder.roomName,
                            "for", bestOrder.price * amount, "credits and",
                            Game.market.calcTransactionCost(amount, this.room.name, bestOrder.roomName), "energy",
                            "reponse:", response);
            }
        }
    }

    run() {
        // buy shortages only if there's enough energy; avoids excessive CPU usage
        if (this.terminal.store[RESOURCE_ENERGY] > 0.9 * this.settings.resourceAmounts[RESOURCE_ENERGY]) {
            this.buyShortages();
        }
    }
}

profiler.registerClass(TerminalBrain, 'TerminalBrain');

module.exports = TerminalBrain;