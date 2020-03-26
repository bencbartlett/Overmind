import {assimilationLocked} from '../assimilation/decorator';
import {Colony} from '../Colony';
import {log} from '../console/log';
import {Mem} from '../memory/Memory';
import {profile} from '../profiler/decorator';
import {Abathur} from '../resources/Abathur';
import {alignedNewline, bullet, leftArrow, rightArrow} from '../utilities/stringConstants';
import {maxBy, minBy, onPublicServer, printRoomName} from '../utilities/utils';

interface MarketCache {
	sell: { [resourceType: string]: { high: number, low: number } };
	buy: { [resourceType: string]: { high: number, low: number } };
	history: {
		[resourceType: string]: {
			avg: number,
			avg14: number,
			std: number,
			std14: number,
		}
	};
	tick: number;
}

interface TraderMemory {
	cache: MarketCache;
	equalizeIndex: number;
}

interface TraderStats {
	credits: number;
	bought: {
		[resourceType: string]: {
			amount: number,
			credits: number,
		}
	};
	sold: {
		[resourceType: string]: {
			amount: number,
			credits: number,
		}
	};
}

const TraderMemoryDefaults: TraderMemory = {
	cache        : {
		sell   : {},
		buy    : {},
		history: {},
		tick   : 0,
	},
	equalizeIndex: 0
};

const TraderStatsDefaults: TraderStats = {
	credits: 0,
	bought : {},
	sold   : {},
};

// Maximum prices I'm willing to pay to buy various resources - based on shard2 market data in June 2018
// (might not always be up to date)
export const maxMarketPrices: { [resourceType: string]: number } = {
	default                          : 5.0,
	[RESOURCE_HYDROGEN]              : 0.3,
	[RESOURCE_OXYGEN]                : 0.25,
	[RESOURCE_UTRIUM]                : 0.3,
	[RESOURCE_LEMERGIUM]             : 0.25,
	[RESOURCE_KEANIUM]               : 0.25,
	[RESOURCE_ZYNTHIUM]              : 0.25,
	[RESOURCE_CATALYST]              : 0.5,
	[RESOURCE_ENERGY]                : 0.05,
	[RESOURCE_CATALYZED_GHODIUM_ACID]: 1.2,
};

export const MAX_ENERGY_SELL_ORDERS = 5;
export const MAX_ENERGY_BUY_ORDERS = 5;
export const MAX_ORDERS_OF_RESOURCE_TYPE = 5;

export const ERR_NO_ORDER_TO_BUY_FROM = -101;
export const ERR_NO_ORDER_TO_SELL_TO = -102;
export const ERR_INSUFFICIENT_ENERGY_IN_TERMINAL = -103; // ERR_NOT_ENOUGH_ENERGY is same as ERR_NOT_ENOUGH_RESOURCES
export const ERR_NOT_ENOUGH_MARKET_DATA = -104;
export const ERR_TOO_MANY_ORDERS_OF_TYPE = -105;


export const MKT = {
	SELL_DIRECT_BELOW_CREDITS    : 75000,
	SELL_ORDER_CREDIT_REQUIREMENT: 10000,
};


/**
 * The trade network controls resource acquisition and disposal on the player market.
 */
@profile
@assimilationLocked
export class TraderJoe implements ITradeNetwork {

	static settings = {
		cache : {
			timeout: 250,
		},
		market: {
			sellDirectLimit: 60000,
			reserveCredits : 100000,		// Always try to stay above this amount
			boostCredits   : 250000,		// You can buy boosts directly off market while above this amount
			energyCredits  : 300000, 	// Can buy energy off market if above this amount
			orders         : {
				timeout      : 500000,	// Remove orders after this many ticks if remaining amount < cleanupAmount
				cleanupAmount: TERMINAL_MIN_SEND,	// RemainingAmount threshold to remove expiring orders
			}
		},
	};

	memory: TraderMemory;
	stats: TraderStats;
	private notifications: string[];

	constructor() {
		this.memory = Mem.wrap(Memory.Overmind, 'trader', TraderMemoryDefaults, true);
		this.stats = Mem.wrap(Memory.stats.persistent, 'trader', TraderStatsDefaults);
		this.notifications = [];
	}

	refresh() {
		this.memory = Mem.wrap(Memory.Overmind, 'trader', TraderMemoryDefaults, true);
		this.stats = Mem.wrap(Memory.stats.persistent, 'trader', TraderStatsDefaults);
		this.notifications = [];
	}

	private notify(msg: string): void {
		this.notifications.push(bullet + msg);
	}

	/**
	 * Builds a cache for market - this is very expensive; use infrequently
	 */
	private buildMarketCache(verbose = false, orderThreshold = 1000): void {
		this.invalidateMarketCache();
		const myActiveOrderIDs = _.map(_.filter(Game.market.orders, order => order.active), order => order.id);
		const allOrders = Game.market.getAllOrders(order => !myActiveOrderIDs.includes(order.id) &&
															order.amount >= orderThreshold); // don't include tiny orders
		const groupedBuyOrders = _.groupBy(_.filter(allOrders, o => o.type == ORDER_BUY), o => o.resourceType);
		const groupedSellOrders = _.groupBy(_.filter(allOrders, o => o.type == ORDER_SELL), o => o.resourceType);
		for (const resourceType in groupedBuyOrders) {
			// Store buy order with maximum price in cache
			const prices = _.map(groupedBuyOrders[resourceType], o => o.price);
			const high = _.max(prices);
			const low = _.min(prices);
			if (verbose) console.log(`${resourceType} BUY: high: ${high}  low: ${low}`);
			// this.memory.cache.buy[resourceType] = minBy(groupedBuyOrders[resourceType], (o:Order) => -1 * o.price);
			this.memory.cache.buy[resourceType] = {high: high, low: low};
		}
		for (const resourceType in groupedSellOrders) {
			// Store sell order with minimum price in cache
			const prices = _.map(groupedSellOrders[resourceType], o => o.price);
			const high = _.max(prices);
			const low = _.min(prices);
			if (verbose) console.log(`${resourceType} SELL: high: ${high}  low: ${low}`);
			// this.memory.cache.sell[resourceType] = minBy(groupedSellOrders[resourceType], (o:Order) => o.price);
			this.memory.cache.sell[resourceType] = {high: high, low: low};
		}
		this.memory.cache.tick = Game.time;
	}

	/**
	 * Builds a cache for market - this is very expensive; use infrequently
	 */
	private buildMarketHistoryCache(): void {
		const history = Game.market.getHistory();
		const historyByResource = _.groupBy(history, hist => hist.resourceType);
		// Compute stats for each resource
		for (const resource in historyByResource) {
			const resourceHistory = _.sortBy(historyByResource[resource], hist => hist.date); // oldest to newest
			const prices = _.map(resourceHistory, hist => hist.avgPrice);

			// Get average price and standard deviation for today
			const avg = _.last(resourceHistory).avgPrice;
			const std = _.last(resourceHistory).stddevPrice;

			// Compute average price over last 14 days
			const avg14 = _.sum(resourceHistory, hist => hist.avgPrice * hist.volume) /
						  _.sum(resourceHistory, hist => hist.volume); // this could be Infinity
			// Compute average standard deviation over last 14 days using Bessel-corrected variance summation
			const std14 = Math.sqrt(
				_.sum(resourceHistory, h => h.volume * (h.avgPrice - avg14) ** 2 + h.stddevPrice ** 2) /
				_.sum(resourceHistory, h => h.volume)
			); // this could be Infinity
			this.memory.cache.history[resource] = {
				avg, std, avg14, std14
			};
		}
	}

	private invalidateMarketCache(): void {
		this.memory.cache = {
			sell   : {},
			buy    : {},
			history: {},
			tick   : 0,
		};
	}

	/**
	 * Returns a list of orders you have already placed for this type for this resource.
	 * If roomName is undefined, count any of your orders; if roomName is specified, only return if order is in room
	 */
	private getExistingOrders(type: ORDER_BUY | ORDER_SELL, resource: ResourceConstant, roomName?: string): Order[] {
		let orders: Order[];
		if (roomName) {
			orders = _.filter(Game.market.orders, order => order.type == type &&
														   order.resourceType == resource &&
														   order.roomName == roomName);
			if (orders.length > 1) {
				log.error(`Multiple orders for ${resource} detected in ${printRoomName(roomName)}!`);
			}
		} else {
			orders = _.filter(Game.market.orders, order => order.type == type && order.resourceType == resource);
		}
		return orders;
	}

	/**
	 * The effective cost in credits of the energy transfer cost per unit to deal to a given order
	 */
	private marginalTransactionPrice(order: Order, dealerRoomName: string): number {
		if (order.roomName) {
			const transferCost = Game.market.calcTransactionCost(10000, order.roomName, dealerRoomName) / 10000;
			const energyToCreditMultiplier = 0.01; // this.cache.sell[RESOURCE_ENERGY] * 1.5;
			return transferCost * energyToCreditMultiplier;
		} else {
			// no order.roomName means subscription token, and I don't trade these so this should never get used
			log.error(`order.roomName is unspecified!`);
			return Infinity;
		}
	}

	/**
	 * Computes the **approximate** cost to obtain the base resources needed to synthesize a compound.
	 * Could be more optimized to include stuff like energy transfer cost, etc.
	 * Returns Infinity if insufficient market data is present.
	 */
	private getCostForBaseIngredients(resource: ResourceConstant, colony?: Colony): number {
		const ingredients = Abathur.enumerateReactionBaseIngredients(resource);
		if (ingredients.length > 0) { // a synthesizeable compound
			return _.sum(ingredients, res =>
				this.memory.cache.history[res] ? this.memory.cache.history[res].avg14 || Infinity : Infinity);
		} else { // not synthesizeable
			if (this.memory.cache.history[resource]) {
				return this.memory.cache.history[resource].avg14;
			} else {
				return Infinity;
			}
		}
	}

	private cleanUpInactiveOrders() {
		// Clean up sell orders that have expired or orders belonging to rooms no longer owned
		const ordersToClean = _.filter(Game.market.orders, o =>
			(o.type == ORDER_SELL && o.active == false && o.remainingAmount == 0)		// if order is expired, or
			|| (Game.time - o.created > TraderJoe.settings.market.orders.timeout		// order is old and almost done
				&& o.remainingAmount < TraderJoe.settings.market.orders.cleanupAmount)
			|| (o.roomName && !Overmind.colonies[o.roomName]));							// order placed from dead colony
		for (const order of ordersToClean) {
			Game.market.cancelOrder(order.id);
		}
	}

	// /**
	//  * Opportunistically sells resources when the buy price is higher than current market sell low price
	//  */
	// private lookForGoodDeals(terminal: StructureTerminal, resource: ResourceConstant, margin = 1.25): void {
	// 	if (Game.market.credits < TraderJoe.settings.market.reserveCredits) {
	// 		return;
	// 	}
	// 	let amount = 5000;
	// 	if (resource === RESOURCE_POWER) {
	// 		amount = 100;
	// 	}
	// 	let ordersForMineral = Game.market.getAllOrders({resourceType: resource, type: ORDER_BUY});
	// 	ordersForMineral = _.filter(ordersForMineral, order => order.amount >= amount);
	// 	if (ordersForMineral === undefined) {
	// 		return;
	// 	}
	// 	// const marketLow = this.memory.cache.sell[resource] ? this.memory.cache.sell[resource].low : undefined;
	// 	const marketEntry = this.memory.cache.resources[resource];
	// 	const marketLow = marketEntry ? marketEntry.avgPrice : undefined;
	// 	if (marketLow == undefined) {
	// 		return;
	// 	}
	//
	// 	const order = maxBy(ordersForMineral, order => this.effectiveBuyPrice(order, terminal));
	// 	if (order && order.price >= (marketLow * margin)) {
	// 		const amount = Math.min(order.amount, 10000);
	// 		const cost = Game.market.calcTransactionCost(amount, terminal.room.name, order.roomName!);
	// 		if (terminal.store[RESOURCE_ENERGY] > cost) {
	// 			const response = Game.market.deal(order.id, amount, terminal.room.name);
	// 			this.logTransaction(order, terminal.room.name, amount, response);
	// 		}
	// 	}
	// }

	/**
	 * Buy a resource on the market, either through a buy order or directly
	 */
	buy(terminal: StructureTerminal, resource: ResourceConstant, amount: number): void {
		if (Game.market.credits < TraderJoe.settings.market.reserveCredits || terminal.cooldown > 0) {
			return;
		}
		amount = Math.max(amount, TERMINAL_MIN_SEND);
		if (terminal.store[RESOURCE_ENERGY] < 10000 || terminal.storeCapacity - _.sum(terminal.store) < amount) {
			return;
		}
		let ordersForMineral = Game.market.getAllOrders({resourceType: resource, type: ORDER_SELL});
		ordersForMineral = _.filter(ordersForMineral, order => order.amount >= amount);
		const bestOrder = minBy(ordersForMineral, (order: Order) => order.price);
		let maxPrice = maxMarketPrices[resource] || maxMarketPrices.default;
		if (!onPublicServer()) {
			maxPrice = Infinity; // don't care about price limits if on private server
		}
		if (bestOrder && bestOrder.price <= maxPrice) {
			const response = Game.market.deal(bestOrder.id, amount, terminal.room.name);
			this.logTransaction(bestOrder, terminal.room.name, amount, response);
		}
	}

	private buyDirectly() {
		// TODO
	}

	/**
	 * Create or maintain a buy order
	 */
	private maintainBuyOrder(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
							 maxOrdersOfType = Infinity): void {
		const marketHigh = this.memory.cache.buy[resource] ? this.memory.cache.buy[resource].high : undefined;
		if (!marketHigh) {
			return;
		}
		const maxPrice = maxMarketPrices[resource] || maxMarketPrices.default;
		if (marketHigh > maxPrice) {
			return;
		}

		const order = _.find(Game.market.orders,
							 o => o.type == ORDER_BUY &&
								  o.resourceType == resource &&
								  o.roomName == terminal.room.name);
		if (order) {

			if (order.price < marketHigh || (order.price > marketHigh && order.remainingAmount == 0)) {
				const ret = Game.market.changeOrderPrice(order.id, marketHigh);
				this.notify(`${terminal.room.print}: updating buy order price for ${resource} from ` +
							`${order.price} to ${marketHigh}. Response: ${ret}`);
			}
			if (order.remainingAmount < 2000) {
				const addAmount = (amount - order.remainingAmount);
				const ret = Game.market.extendOrder(order.id, addAmount);
				this.notify(`${terminal.room.print}: extending buy order for ${resource} by ${addAmount}.` +
							` Response: ${ret}`);
			}

		} else {

			const ordersOfType = _.filter(Game.market.orders, o => o.type == ORDER_BUY && o.resourceType == resource);
			if (ordersOfType.length < maxOrdersOfType) {
				const params = {
					type        : ORDER_BUY,
					resourceType: resource,
					price       : marketHigh,
					totalAmount : amount,
					roomName    : terminal.room.name
				};
				const ret = Game.market.createOrder(params);
				this.notify(`${terminal.room.print}: creating buy order for ${resource} at price ${marketHigh}. ` +
							`Response: ${ret}`);
			}
			// else {
			// 	this.notify(`${terminal.room.print}: cannot create another buy order for ${resource}:` +
			// 				` too many (${ordersOfType.length})`);
			// }

		}
	}

	/**
	 * Sell a resource on the market, either through a sell order or directly
	 */
	sell(terminal: StructureTerminal, resource: ResourceConstant, amount: number, preferDirect = false): number {

		if (resource == RESOURCE_ENERGY) {
			// TODO
		}

		// If you don't have a lot of credits or preferDirect==true, try to sell directly to an existing buy order
		if (Game.market.credits < MKT.SELL_DIRECT_BELOW_CREDITS || preferDirect) {
			if (this.getExistingOrders(ORDER_SELL, resource, terminal.room.name).length == 0) {
				const result = this.sellDirectly(terminal, resource, amount);
				if (result != ERR_NO_ORDER_TO_BUY_FROM && result != ERR_INSUFFICIENT_ENERGY_IN_TERMINAL) {
					return result;
				}
			}
		}

		// If you have enough credits or if there are no buy orders to sell to, create / maintain a sell order
		if (Game.market.credits >= MKT.SELL_ORDER_CREDIT_REQUIREMENT) {
			const result = this.maintainSellOrder(terminal, resource, amount);
			return result;
		}

		// No action needed
		return OK;
	}

	/**
	 * Sell resources directly to a buyer rather than making a sell order
	 */
	private sellDirectly(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
						 flexibleAmount = true): number {
		// If terminal is on cooldown or just did something then return tired
		if (!terminal.isReady) {
			return ERR_TIRED;
		}
		// If flexibleAmount is allowed, consider selling to orders which don't need the full amount
		const minAmount = flexibleAmount ? TERMINAL_MIN_SEND : amount;
		const validOrders = _.filter(Game.market.getAllOrders({resourceType: resource, type: ORDER_BUY}),
									 order => order.amount >= minAmount);

		// Find the best order, maximizing by (buying price - marginal loss from transaction)
		const order = maxBy(validOrders, order => order.price
												  - this.marginalTransactionPrice(order, terminal.room.name)
												  + order.amount / 1000000000); // last bit prioritizes biggest orders

		// If you find a valid order, execute it
		if (order) {
			const sellAmount = Math.min(order.amount, amount);
			const cost = Game.market.calcTransactionCost(sellAmount, terminal.room.name, order.roomName!);
			if (terminal.store[RESOURCE_ENERGY] >= cost) {
				const response = Game.market.deal(order.id, sellAmount, terminal.room.name);
				this.logTransaction(order, terminal.room.name, amount, response);
				return response;
			} else {
				return ERR_INSUFFICIENT_ENERGY_IN_TERMINAL;
			}
		}
		// Otherwise notify a warning and return an error so it can be handled in .sell()
		else {
			this.notify(`No valid market order to sell to! Sell request: ${amount} ${resource} from ` +
						`${printRoomName(terminal.room.name)}`);
			return ERR_NO_ORDER_TO_BUY_FROM;
		}
	}

	/**
	 * Computes a competitive market price to sell resources at or to adjust existing sell orders to.
	 * Returns Infinity if sanity checks are not passed or if there is insufficient data to generate a sell price.
	 */
	private computeCompetitiveSellPrice(resource: ResourceConstant, roomName: string): number {

		const allOrdersOfResource = _.groupBy(Game.market.getAllOrders({resourceType: resource}), 'type');
		const allBuyOrders = allOrdersOfResource[ORDER_BUY];
		const allSellOrders = allOrdersOfResource[ORDER_SELL];

		const highestBuyOrderPrice = _.max(_.map(allBuyOrders, order =>
			order.price - this.marginalTransactionPrice(order, roomName)));
		const lowestSellOrderPrice = _.min(_.map(allSellOrders, order =>
			order.price + this.marginalTransactionPrice(order, roomName)));

		const marketRate = Math.max(lowestSellOrderPrice, highestBuyOrderPrice * 1.1, 0);

		const discountMagnitude = 0.05;
		let discount = 1;
		const existingOrder = _.first(this.getExistingOrders(ORDER_SELL, resource, roomName));
		if (existingOrder) {
			const timeOnMarket = Game.time - existingOrder.created;
			const orderDiscountTimescale = 100000; // should be less than the timeout value
			discount = (discount + timeOnMarket / orderDiscountTimescale) / 2;
		}
		const discountFactor = 1 - discountMagnitude * discountMagnitude;
		const price = marketRate * discountFactor;

		const priceForBaseResources = this.getCostForBaseIngredients(resource);

		if (price != 0 && price != Infinity) {
			if (priceForBaseResources != 0 && priceForBaseResources != Infinity
				&& price < priceForBaseResources * discountFactor) {
				// Not sensible to sell at this amount
				return Infinity;
			}
			return price;
		}

		// Generally shouldn't get here
		return Infinity;
	}

	/**
	 * Create or maintain a sell order
	 */
	private maintainSellOrder(terminal: StructureTerminal, resource: ResourceConstant, amount: number): number {

		const existingOrder = _.first(this.getExistingOrders(ORDER_SELL, resource, terminal.room.name));

		// This is all somewhat expensive so only do this occasionally
		if (Game.time % 10 == 5) {
			return OK; // No action needed on these ticks
		}

		// Maintain an existing order
		if (existingOrder) {
			// Figure out if price should be changed - if the competitive price is now significantly different
			const sellPrice = this.computeCompetitiveSellPrice(resource, terminal.room.name);
			if (sellPrice == Infinity || sellPrice == 0) {
				return ERR_NOT_ENOUGH_MARKET_DATA;
			}
			const ratio = existingOrder.price / sellPrice;
			const tolerance = 0.03;
			const normalFluctuation = (1 + tolerance > ratio && ratio > 1 - tolerance);

			// Extend the order if you need to sell more of the resource
			if (amount > existingOrder.remainingAmount && normalFluctuation) {
				const addAmount = amount - existingOrder.remainingAmount;
				const ret = Game.market.extendOrder(existingOrder.id, addAmount);
				this.notify(`${terminal.room.print}: extending sell order for ${resource} by ${addAmount}.` +
							` Response: ${ret}`);
				return ret;
			}

			if (!normalFluctuation) {
				const ret = Game.market.changeOrderPrice(existingOrder.id, sellPrice);
				this.notify(`${terminal.room.print}: updating sell order price for ${resource} from ` +
							`${existingOrder.price} to ${sellPrice}. Response: ${ret}`);
				return ret;
			}

			// No action needed
			return OK;
		}
		// Create a new sell order
		else {
			// Compute the sale price
			const sellPrice = this.computeCompetitiveSellPrice(resource, terminal.room.name);
			if (sellPrice == Infinity || sellPrice == 0) {
				return ERR_NOT_ENOUGH_MARKET_DATA;
			}

			// adjust the sell amount to only immediately list what you can afford; it can be extended later
			const brokersFee = sellPrice * amount * MARKET_FEE;
			if (Game.market.credits < brokersFee) {
				amount = amount * Game.market.credits / brokersFee * 0.9;
			}

			// Only place up to a certain amount of orders
			const existingOrdersForThis = this.getExistingOrders(ORDER_SELL, resource);
			if (existingOrdersForThis.length < MAX_ORDERS_OF_RESOURCE_TYPE) {
				const params = {
					type        : ORDER_SELL,
					resourceType: resource,
					price       : sellPrice,
					totalAmount : amount,
					roomName    : terminal.room.name
				};
				const ret = Game.market.createOrder(params);
				this.notify(`${terminal.room.print}: creating sell order for ${resource} at price ${sellPrice}. ` +
							`Response: ${ret}`);
				return ret;
			} else {
				this.notify(`${terminal.room.print}: could not create sell order for ${resource} - too many existing!`);
				return ERR_TOO_MANY_ORDERS_OF_TYPE;
			}
		}
	}

	/**
	 * Returns the approximate price of a mineral - shouldn't be used for optimizing prices, just as a ballpark
	 * feasibility estimate
	 */
	priceOf(mineralType: ResourceConstant): number {
		if (this.memory.cache.history[mineralType]) {
			return this.memory.cache.history[mineralType].avg;
		} else {
			return Infinity;
		}
	}

	/**
	 * Pretty-prints transaction information in the console
	 */
	private logTransaction(order: Order, terminalRoomName: string, amount: number, response: number): void {
		const action = order.type == ORDER_SELL ? 'BOUGHT ' : 'SOLD   ';
		const cost = (order.price * amount).toFixed(2);
		const fee = order.roomName ? Game.market.calcTransactionCost(amount, order.roomName, terminalRoomName) : 0;
		const roomName = Game.rooms[terminalRoomName] ? Game.rooms[terminalRoomName].print : terminalRoomName;
		let msg: string;
		if (order.type == ORDER_SELL) {
			msg = `${roomName} ${leftArrow} ${amount} ${order.resourceType} ${leftArrow} ` +
				  `${printRoomName(order.roomName!)} (result: ${response})`;
		} else {
			msg = `${roomName} ${rightArrow} ${amount} ${order.resourceType} ${rightArrow} ` +
				  `${printRoomName(order.roomName!)} (result: ${response})`;
		}
		this.notify(msg);
	}

	/**
	 * Look through transactions happening on the previous tick and record stats
	 */
	private recordStats(): void {
		this.stats.credits = Game.market.credits;
		const time = Game.time - 1;
		// Incoming transactions
		for (const transaction of Game.market.incomingTransactions) {
			if (transaction.time < time) {
				break; // only look at things from last tick
			} else {
				if (transaction.order) {
					const resourceType = transaction.resourceType;
					const amount = transaction.amount;
					const price = transaction.order.price;
					if (!this.stats.bought[resourceType]) {
						this.stats.bought[resourceType] = {amount: 0, credits: 0};
					}
					this.stats.bought[resourceType].amount += amount;
					this.stats.bought[resourceType].credits += amount * price;
				}
			}
		}
		// Outgoing transactions
		for (const transaction of Game.market.outgoingTransactions) {
			if (transaction.time < time) {
				break; // only look at things from last tick
			} else {
				if (transaction.order) {
					const resourceType = transaction.resourceType;
					const amount = transaction.amount;
					const price = transaction.order.price;
					if (!this.stats.sold[resourceType]) {
						this.stats.sold[resourceType] = {amount: 0, credits: 0};
					}
					this.stats.sold[resourceType].amount += amount;
					this.stats.sold[resourceType].credits += amount * price;
				}
			}
		}
	}


	init(): void {
		if (Game.time - (this.memory.cache.tick || 0) > TraderJoe.settings.cache.timeout) {
			this.buildMarketCache();
			this.buildMarketHistoryCache();
		}
	}

	run(): void {
		if (Game.time % 10 == 0) {
			this.cleanUpInactiveOrders();
		}
		if (this.notifications.length > 0) {
			log.info(`Trade network activity: ` + alignedNewline + this.notifications.join(alignedNewline));
		}
		this.recordStats();
	}

}
