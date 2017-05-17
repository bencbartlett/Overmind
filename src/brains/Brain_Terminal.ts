// Terminal brain - executes market orders to maintain an equilibrium amount of resources

import terminalSettings = require("../settings/settings_terminal");

export class TerminalBrain {
    name: string;
    room: Room;
    terminal: StructureTerminal;
    settings: any;

    constructor(roomName: string) {
        this.name = roomName;
        this.room = Game.rooms[roomName];
        this.terminal = Game.rooms[roomName].terminal!;
        this.settings = terminalSettings;
        this.settings.excessTransferAmount = 100000;
    }

    log(message: string) {
        console.log(this.name + '_Terminal_Brain: "' + message + '"');
    }

    effectivePricePerUnit(order: Order) {
        if (order.roomName) {
            let transferCost = Game.market.calcTransactionCost(1000, this.room.name, order.roomName) / 1000;
            return order.price + transferCost;
        } else {
            return Infinity;
        }
    }

    calculateShortages() {
        if (Game.market.credits < reserveCredits) {
            return null;
        }
        var toBuy: {[mineral: string]: number} = {};
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

    buyShortages(): void { // buy needed minerals from the market for the best price, including energy
        var toBuy = this.calculateShortages();
        if (toBuy != {}) { // nothing to buy
            for (let mineral in toBuy!) {
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
                    }
                }
                if (bestOrder && bestOrder.roomName &&
                    this.effectivePricePerUnit(bestOrder) < this.settings.maxBuyPrice[mineral]) {
                    let amount = Math.min(bestOrder.remainingAmount, toBuy![mineral]);
                    let response = Game.market.deal(bestOrder.id, amount, this.room.name);
                    console.log(this.name + ": bought", amount, mineral, "from", bestOrder.roomName,
                                "for", bestOrder.price * amount, "credits and",
                                Game.market.calcTransactionCost(amount, this.room.name, bestOrder.roomName), "energy",
                                "reponse:", response);
                }
            }
        }
    }

    sendExtraEnergy() {
        // calculate best room to send energy to
        var minCost = Infinity;
        var minRoom = null;
        for (let name in Game.rooms) {
            let room = Game.rooms[name];
            if (room.my && room.terminal &&
                room.storage && room.storage.energy < room.overlord.settings.unloadStorageBuffer) {
                let cost = Game.market.calcTransactionCost(this.settings.excessTransferAmount,
                                                           this.room.name, room.name);
                if (cost < minCost) {
                    minCost = cost;
                    minRoom = room.name;
                }
            }
        }
        // if you have sufficient energy in terminal
        if (minRoom && this.terminal.energy > this.settings.excessTransferAmount + minCost) {
            let res = this.terminal.send(RESOURCE_ENERGY, this.settings.excessTransferAmount, minRoom,
                                         "Excess energy transfer");
            this.log(`Sent ${this.settings.excessTransferAmount} excess energy to ${minRoom}. Response: ${res}.`);
        }
    }

    run() {
        // send excess energy if terminal and storage both have too much energy
        if (this.terminal.energy >
            this.settings.resourceAmounts[RESOURCE_ENERGY] + this.settings.excessTransferAmount && this.room.storage &&
            this.room.storage.energy > this.room.overlord.settings.unloadStorageBuffer) {
            this.sendExtraEnergy();
        }
        // buy shortages only if there's enough energy; avoids excessive CPU usage
        if (this.terminal.energy > 0.9 * this.settings.resourceAmounts[RESOURCE_ENERGY]) {
            this.buyShortages();
        }
    }
}

import profiler = require('../lib/screeps-profiler');
profiler.registerClass(TerminalBrain, 'TerminalBrain');
