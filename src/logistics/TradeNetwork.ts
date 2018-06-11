import {log} from '../lib/logger/log';
import {Mem} from '../memory';
import minBy from 'lodash.minby';
import {profile} from '../profiler/decorator';

// interface OrderCache {
// 	id: string,
// 	resourceType: ResourceConstant,
// 	roomName: string,
// 	amount: number,
// 	price: number,
// }

interface MarketCache {
	// sell: {[resourceType: string]: Order | undefined},
	// buy: {[resourceType: string]: Order | undefined},
	sell: { [resourceType: string]: { high: number, low: number } },
	buy: { [resourceType: string]: { high: number, low: number } },
	tick: number,
}

interface TraderMemory {
	cache: MarketCache;
	equalizeIndex: number;
}

const TraderMemoryDefaults: TraderMemory = {
	cache        : {
		sell: {},
		buy : {},
		tick: 0,
	},
	equalizeIndex: 0,
};


@profile
export class TraderJoe implements ITradeNetwork {

	static settings = {
		cache : {
			timeout: 25,
		},
		market: {
			reserveCredits       : 10000,
			requestResourceAmount: 1000,
			maxPrice             : {
				default: 5.0,
			}
		},
	};

	memory: TraderMemory;
	stats: any;

	constructor() {
		this.memory = Mem.wrap(Memory.Overmind, 'trader', TraderMemoryDefaults, true);
		this.stats = Mem.wrap(Memory.stats.persistent, 'trader');
	}

	/* Builds a cache for market - this is very expensive; use infrequently */
	private buildMarketCache(): void {
		this.invalidateMarketCache();
		let allOrders = Game.market.getAllOrders();
		let groupedBuyOrders = _.groupBy(_.filter(allOrders, o => o.type == ORDER_BUY), o => o.resourceType);
		let groupedSellOrders = _.groupBy(_.filter(allOrders, o => o.type == ORDER_SELL), o => o.resourceType);
		for (let resourceType in groupedBuyOrders) {
			// Store buy order with maximum price in cache
			let prices = _.map(groupedBuyOrders[resourceType], o => o.price);
			let high = _.max(prices);
			let low = _.min(prices);
			// this.memory.cache.buy[resourceType] = minBy(groupedBuyOrders[resourceType], (o:Order) => -1 * o.price);
			this.memory.cache.buy[resourceType] = {high: high, low: low};
		}
		for (let resourceType in groupedSellOrders) {
			// Store sell order with minimum price in cache
			let prices = _.map(groupedSellOrders[resourceType], o => o.price);
			let high = _.max(prices);
			let low = _.min(prices);
			// this.memory.cache.sell[resourceType] = minBy(groupedSellOrders[resourceType], (o:Order) => o.price);
			this.memory.cache.sell[resourceType] = {high: high, low: low};
		}
		this.memory.cache.tick = Game.time;
	}

	private invalidateMarketCache(): void {
		this.memory.cache = {
			sell: {},
			buy : {},
			tick: 0,
		};
	}

	/* Cost per unit including transfer price with energy converted to credits */
	private effectivePricePerUnit(order: Order, terminal: StructureTerminal): number {
		if (order.roomName) {
			let transferCost = Game.market.calcTransactionCost(1000, order.roomName, terminal.room.name) / 1000;
			let energyToCreditMultiplier = 0.01; //this.cache.sell[RESOURCE_ENERGY] * 1.5;
			return order.price + transferCost * energyToCreditMultiplier;
		} else {
			return Infinity;
		}
	}

	// private getBestOrder(mineralType: ResourceConstant, type: 'buy' | 'sell'): Order | undefined {
	// 	let cachedOrder = this.memory.cache[type][mineralType];
	// 	if (cachedOrder) {
	// 		let order = Game.market.getOrderById(cachedOrder.id);
	// 		if (order) {
	// 			// Update the order in memory
	// 			this.memory.cache[type][mineralType] = order;
	// 		}
	// 	}
	// }

	priceOf(mineralType: ResourceConstant): number {
		if (this.memory.cache.sell[mineralType]) {
			return this.memory.cache.sell[mineralType].low;
		} else {
			return Infinity;
		}
	}

	buyMineral(terminal: StructureTerminal, mineralType: ResourceConstant, amount: number) {
		amount += 10;
		if (terminal.store[RESOURCE_ENERGY] < 10000 || terminal.storeCapacity - _.sum(terminal.store) < amount) {
			return;
		}
		let ordersForMineral = Game.market.getAllOrders(
			order => order.type == ORDER_SELL && order.resourceType == mineralType && order.amount >= amount
		);
		let bestOrder = minBy(ordersForMineral, (order: Order) => order.price) as Order;
		let maxPrice = TraderJoe.settings.market.maxPrice.default;
		if (bestOrder && bestOrder.price <= maxPrice) {
			let response = Game.market.deal(bestOrder.id, amount, terminal.room.name);
			this.logTransaction(bestOrder, terminal.room.name, amount, response);
		}
	}

	private logTransaction(order: Order, destinationRoomName: string, amount: number, response: number): void {
		let action = order.type == ORDER_SELL ? 'bought' : 'sold';
		let fee = order.roomName ? Game.market.calcTransactionCost(amount, order.roomName, destinationRoomName) : 0;
		let roomName = Game.rooms[destinationRoomName] ? Game.rooms[destinationRoomName].print : destinationRoomName;
		log.info(`${roomName}: ${action} ${amount} of ${order.resourceType} at ${order.roomName}.  ` +
				 `Price: ${order.price * amount} credits  Fee: ${fee} energy  Response: ${response}`);
	}


	init(): void {
		if (Game.time - this.memory.cache.tick > TraderJoe.settings.cache.timeout) {
			this.buildMarketCache();
		}
	}

	run(): void {

	}

}
