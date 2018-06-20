import {log} from '../console/log';
import {Mem} from '../Memory';
import {profile} from '../profiler/decorator';
import {maxBy, minBy} from '../utilities/utils';

interface MarketCache {
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

// Maximum prices I'm willing to pay to buy various resources - based on shard2 market data in June 2018
// (might not always be up to date)
export const maxMarketPrices: { [resourceType: string]: number } = {
	default             : 5.0,
	[RESOURCE_HYDROGEN] : 0.3,
	[RESOURCE_OXYGEN]   : 0.25,
	[RESOURCE_UTRIUM]   : 0.3,
	[RESOURCE_LEMERGIUM]: 0.25,
	[RESOURCE_KEANIUM]  : 0.25,
	[RESOURCE_ZYNTHIUM] : 0.25,
	[RESOURCE_CATALYST] : 0.4,
};

@profile
export class TraderJoe implements ITradeNetwork {

	static settings = {
		cache : {
			timeout: 25,
		},
		market: {
			reserveCredits: 10000,	// Always try to stay above this amount
			boostCredits  : 15000,	// You can buy boosts directly off market while above this amount
			orders        : {
				timeout      : 100000,	// Remove sell orders after this many ticks if remaining amount < cleanupAmount
				cleanupAmount: 10,		// RemainingAmount threshold to remove expiring orders
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
	private buildMarketCache(verbose = false): void {
		this.invalidateMarketCache();
		let myActiveOrderIDs = _.map(_.filter(Game.market.orders, order => order.active), order => order.id);
		let allOrders = Game.market.getAllOrders(order => !myActiveOrderIDs.includes(order.id) &&
														  order.amount >= 1000); // don't include tiny orders in costs
		let groupedBuyOrders = _.groupBy(_.filter(allOrders, o => o.type == ORDER_BUY), o => o.resourceType);
		let groupedSellOrders = _.groupBy(_.filter(allOrders, o => o.type == ORDER_SELL), o => o.resourceType);
		for (let resourceType in groupedBuyOrders) {
			// Store buy order with maximum price in cache
			let prices = _.map(groupedBuyOrders[resourceType], o => o.price);
			let high = _.max(prices);
			let low = _.min(prices);
			if (verbose) console.log(`${resourceType} BUY: high: ${high}  low: ${low}`);
			// this.memory.cache.buy[resourceType] = minBy(groupedBuyOrders[resourceType], (o:Order) => -1 * o.price);
			this.memory.cache.buy[resourceType] = {high: high, low: low};
		}
		for (let resourceType in groupedSellOrders) {
			// Store sell order with minimum price in cache
			let prices = _.map(groupedSellOrders[resourceType], o => o.price);
			let high = _.max(prices);
			let low = _.min(prices);
			if (verbose) console.log(`${resourceType} SELL: high: ${high}  low: ${low}`);
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
	private effectivePrice(order: Order, terminal: StructureTerminal): number {
		if (order.roomName) {
			let transferCost = Game.market.calcTransactionCost(1000, order.roomName, terminal.room.name) / 1000;
			let energyToCreditMultiplier = 0.01; //this.cache.sell[RESOURCE_ENERGY] * 1.5;
			return order.price + transferCost * energyToCreditMultiplier;
		} else {
			return Infinity;
		}
	}

	/* Cost per unit for a buy order including transfer price with energy converted to credits */
	private effectiveBuyPrice(order: Order, terminal: StructureTerminal): number {
		if (order.roomName) {
			let transferCost = Game.market.calcTransactionCost(1000, order.roomName, terminal.room.name) / 1000;
			let energyToCreditMultiplier = 0.01; //this.cache.sell[RESOURCE_ENERGY] * 1.5;
			return order.price - transferCost * energyToCreditMultiplier;
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

	private cleanUpInactiveOrders() {
		// Clean up sell orders that have expired or orders belonging to rooms no longer owned
		let ordersToClean = _.filter(Game.market.orders, o =>
			(o.type == ORDER_SELL && o.active == false && o.remainingAmount == 0)		// if order is expired, or
			|| (Game.time - o.created > TraderJoe.settings.market.orders.timeout		// order is old and almost done
				&& o.remainingAmount < TraderJoe.settings.market.orders.cleanupAmount)
			|| (o.roomName && !Overmind.colonies[o.roomName]));							// order placed from dead colony
		for (let order of ordersToClean) {
			Game.market.cancelOrder(order.id);
		}
	}

	/* Opportunistically sells resources when the buy price is higher than current market sell low price*/
	lookForGoodDeals(terminal: StructureTerminal, mineral: string, margin = 1.25): void {
		if (Game.market.credits < TraderJoe.settings.market.reserveCredits) {
			return;
		}
		let amount = 5000;
		if (mineral === RESOURCE_POWER) {
			amount = 100;
		}
		let ordersForMineral = Game.market.getAllOrders(function (o: Order) {
			return o.type === ORDER_BUY && o.resourceType === mineral && o.amount >= amount;
		}) as Order[];
		if (ordersForMineral === undefined) {
			return;
		}
		let marketLow = this.memory.cache.sell[mineral] ? this.memory.cache.sell[mineral].low : undefined;
		if (marketLow == undefined) {
			return;
		}
		let order = maxBy(ordersForMineral, order => this.effectiveBuyPrice(order, terminal));
		if (order && order.price > marketLow * margin) {
			let amount = Math.min(order.amount, 10000);
			let cost = Game.market.calcTransactionCost(amount, terminal.room.name, order.roomName!);
			if (terminal.store[RESOURCE_ENERGY] > cost) {
				let response = Game.market.deal(order.id, amount, terminal.room.name);
				this.logTransaction(order, terminal.room.name, amount, response);
			}
		}
	}

	/* Sell resources directly to a buyer rather than making a sell order */
	sellDirectly(terminal: StructureTerminal, resource: ResourceConstant, amount = 1000): void {
		let ordersForMineral = Game.market.getAllOrders(
			o => o.type == ORDER_BUY && o.resourceType == resource && o.amount >= amount
		);
		if (!ordersForMineral) {
			return;
		}
		let order = maxBy(ordersForMineral, order => this.effectiveBuyPrice(order, terminal));
		if (order) {
			let sellAmount = Math.min(order.amount, amount);
			let cost = Game.market.calcTransactionCost(sellAmount, terminal.room.name, order.roomName!);
			if (terminal.store[RESOURCE_ENERGY] > cost) {
				let response = Game.market.deal(order.id, sellAmount, terminal.room.name);
				this.logTransaction(order, terminal.room.name, amount, response);
			}
		}
	}

	/* Create or maintain a sell order */
	private maintainSellOrder(terminal: StructureTerminal, resource: ResourceConstant, amount = 10000): void {
		let marketLow = this.memory.cache.sell[resource] ? this.memory.cache.sell[resource].low : undefined;
		if (!marketLow) {
			return;
		}
		let mySellOrders = _.filter(Game.market.orders,
									o => o.type == ORDER_SELL &&
										 o.resourceType == resource &&
										 o.roomName == terminal.room.name);
		if (mySellOrders.length > 0) {
			for (let order of mySellOrders) {
				if (order.price > marketLow || (order.price < marketLow && order.remainingAmount == 0)) {
					let ret = Game.market.changeOrderPrice(order.id, marketLow);
					log.info(`${terminal.room.print}: updating sell order price for ${resource} from ${order.price} ` +
							 `to ${marketLow}. Response: ${ret}`);
				}
				if (order.remainingAmount < 2000) {
					let addAmount = (amount - order.remainingAmount);
					let ret = Game.market.extendOrder(order.id, addAmount);
					log.info(`${terminal.room.print}: extending sell order for ${resource} by ${addAmount}.` +
							 ` Response: ${ret}`);
				}
			}
		} else {
			let ret = Game.market.createOrder(ORDER_SELL, resource, marketLow, amount, terminal.room.name);
			log.info(`${terminal.room.print}: creating sell order for ${resource} at price ${marketLow}. ` +
					 `Response: ${ret}`);
		}
	}

	sell(terminal: StructureTerminal, resource: ResourceConstant, amount = 10000): void {
		if (Game.market.credits < TraderJoe.settings.market.reserveCredits) {
			this.sellDirectly(terminal, resource, amount);
		} else {
			this.maintainSellOrder(terminal, resource, amount);
		}
	}

	priceOf(mineralType: ResourceConstant): number {
		if (this.memory.cache.sell[mineralType]) {
			return this.memory.cache.sell[mineralType].low;
		} else {
			return Infinity;
		}
	}

	buyMineral(terminal: StructureTerminal, mineralType: ResourceConstant, amount: number): void {
		if (Game.market.credits < TraderJoe.settings.market.reserveCredits || terminal.cooldown > 0) {
			return;
		}
		amount += 10;
		if (terminal.store[RESOURCE_ENERGY] < 10000 || terminal.storeCapacity - _.sum(terminal.store) < amount) {
			return;
		}
		let ordersForMineral = Game.market.getAllOrders(
			order => order.type == ORDER_SELL && order.resourceType == mineralType && order.amount >= amount
		);
		let bestOrder = minBy(ordersForMineral, (order: Order) => order.price);
		let maxPrice = maxMarketPrices[mineralType] || maxMarketPrices.default;
		let onMMO = Game.shard.name.includes('shard');
		if (!onMMO) {
			maxPrice = Infinity; // don't care about price limits if on private server
		}
		if (bestOrder && bestOrder.price <= maxPrice) {
			let response = Game.market.deal(bestOrder.id, amount, terminal.room.name);
			this.logTransaction(bestOrder, terminal.room.name, amount, response);
		}
	}

	private logTransaction(order: Order, destinationRoomName: string, amount: number, response: number): void {
		let action = order.type == ORDER_SELL ? 'bought' : 'sold';
		let cost = (order.price * amount).toFixed(2);
		let fee = order.roomName ? Game.market.calcTransactionCost(amount, order.roomName, destinationRoomName) : 0;
		let roomName = Game.rooms[destinationRoomName] ? Game.rooms[destinationRoomName].print : destinationRoomName;
		log.info(`${roomName}: ${action} ${amount} of ${order.resourceType} at ${order.roomName}.  ` +
				 `Price: ${cost} credits  Fee: ${fee} energy  Response: ${response}`);
	}


	init(): void {
		if (Game.time - (this.memory.cache.tick || 0) > TraderJoe.settings.cache.timeout) {
			this.buildMarketCache();
		}
	}

	run(): void {
		if (Game.time % 10 == 0) {
			this.cleanUpInactiveOrders();
		}
	}

}
