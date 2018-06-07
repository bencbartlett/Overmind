import {log} from '../lib/logger/log';
import {Mem} from '../memory';
import {profile} from '../profiler/decorator';

interface TraderMemory {
	cache: {
		sellPrice: { [resourceType: string]: number },
	};
	equalizeIndex: number;
}

@profile
export class TraderJoe {

	private cache: {
		sellPrice: { [resourceType: string]: number }
	};
	static settings = {
		market: {
			reserveCredits       : 10000,
			requestResourceAmount: 1000,
			maxPrice             : {
				default: 5.0,
			}
		},
	};

	constructor(terminals: StructureTerminal[]) {
		this.cache = this.memory.cache;
	}

	get memory(): TraderMemory {
		return Mem.wrap(Memory.Overmind, 'trader', {
			cache        : {
				sellPrice: {},
			},
			equalizeIndex: 0,
		});
	}

	static get stats() {
		return Mem.wrap(Memory.stats.persistent, 'trader');
	}

	private cacheBestSellPrices(): void {
		// Recache best selling prices on the market
		if (!this.memory.cache.sellPrice) {
			this.memory.cache.sellPrice = {};
		}
		let allOrders = Game.market.getAllOrders({type: ORDER_SELL});
		let groupedOrders = _.groupBy(allOrders, order => order.resourceType);
		for (let resourceType in groupedOrders) {
			this.memory.cache.sellPrice[resourceType] = _.min(_.map(groupedOrders[resourceType], order => order.price));
		}
	}

	/* Cost per unit including transfer price with energy converted to credits */
	private effectivePricePerUnit(order: Order, terminal: StructureTerminal): number {
		if (order.roomName) {
			let transferCost = Game.market.calcTransactionCost(1000, order.roomName, terminal.room.name) / 1000;
			let energyToCreditMultiplier = 0.3; //this.cache.sellPrice[RESOURCE_ENERGY] * 1.5;
			return order.price + transferCost * energyToCreditMultiplier;
		} else {
			return Infinity;
		}
	}

	// private buyShortages(terminal: StructureTerminal): void {
	// 	let shortages = this.calculateShortages(terminal);
	// 	for (let resourceType in shortages) {
	// 		let orders = Game.market.getAllOrders(order => order.type == ORDER_SELL &&
	// 													   !!order.roomName &&
	// 													   order.resourceType == resourceType &&
	// 													   order.remainingAmount > 100);
	// 		let bestOrder = minBy(orders, (order: Order) => this.effectivePricePerUnit(order, terminal));
	// 		if (this.effectivePricePerUnit(bestOrder, terminal) <= this.settings.market.maxPrice[resourceType]) {
	// 			let amount = Math.min(bestOrder.remainingAmount, shortages[resourceType]);
	// 			let response = Game.market.deal(bestOrder.id, amount, terminal.room.name);
	// 			this.logTransaction(bestOrder, terminal.room.name, amount, response);
	// 		}
	// 	}
	// }

	private logTransaction(order: Order, destinationRoomName: string, amount: number, response: number): void {
		let action = order.type == ORDER_SELL ? 'Bought' : 'Sold';
		let fee = order.roomName ? Game.market.calcTransactionCost(amount, order.roomName, destinationRoomName) : 0;
		log.info(`${destinationRoomName}: ${action} ${amount} of ${order.resourceType} from ${order.roomName} ` +
				 `for ${order.price * amount} credits and ${fee} energy. Response: ${response}`);

	}


	init(): void {

	}

	run(): void {

	}

}
