import {assimilationLocked} from '../assimilation/decorator';
import {log} from '../console/log';
import {Mem} from '../memory/Memory';
import {profile} from '../profiler/decorator';
import {Abathur} from '../resources/Abathur';
import {alignedNewline, bullet, leftArrow, rightArrow} from '../utilities/stringConstants';
import {maxBy, minBy, printRoomName} from '../utilities/utils';
import {RESERVE_CREDITS} from '../~settings';

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

export const ERR_NO_ORDER_TO_BUY_FROM = -101;
export const ERR_NO_ORDER_TO_SELL_TO = -102;
export const ERR_INSUFFICIENT_ENERGY_IN_TERMINAL = -103; // ERR_NOT_ENOUGH_ENERGY is same as ERR_NOT_ENOUGH_RESOURCES
export const ERR_NOT_ENOUGH_MARKET_DATA = -104;
export const ERR_TOO_MANY_ORDERS_OF_TYPE = -105;
export const ERR_BUY_DIRECT_PRICE_TOO_EXPENSIVE = -106;
export const ERR_CREDIT_THRESHOLDS = -107;

const defaultTradeOpts: TradeOpts = {
	preferDirect    : false,
	flexibleAmount  : true,
	ignoreMinAmounts: false,
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
			credits: {
				mustSellDirectBelow    : 70000,
				canPlaceSellOrdersAbove: 10000,
				canBuyAbove            : 20000,
				canBuyBoostsAbove      : 2 * Math.max(RESERVE_CREDITS, 1e5),
				canBuyEnergyAbove      : 3 * Math.max(RESERVE_CREDITS, 1e5),
			},
			orders : {
				timeout             : 500000, // Remove orders after this many ticks if remaining amount < cleanupAmount
				cleanupAmount       : 100,	  // RemainingAmount threshold to remove expiring orders
				maxEnergySellOrders : 5,
				maxEnergyBuyOrders  : 5,
				maxOrdersForResource: 5,
				minSellOrderAmount  : 5000,
				maxSellOrderAmount  : 25000,
				minSellDirectAmount : 250,
				maxSellDirectAmount : 10000,
				minBuyOrderAmount   : 1000,
				minBuyDirectAmount  : 500,
				maxBuyOrderAmount   : 25000,
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
	 * Pretty-prints transaction information in the console
	 */
	private logTransaction(order: Order, terminalRoomName: string, amount: number, response: number): void {
		const cost = (order.price * amount).toFixed(0);
		const fee = order.roomName ? Game.market.calcTransactionCost(amount, order.roomName, terminalRoomName) : 0;
		const roomName = printRoomName(terminalRoomName, true);
		let msg: string;
		if (order.type == ORDER_SELL) { // I am buying
			msg = `Direct: ${roomName} ${leftArrow} ${Math.round(amount)} ${order.resourceType} ${leftArrow} ` +
				  `${printRoomName(order.roomName!)} (-${cost}c)`;
			if (response != OK) {
				msg += ` (ERROR: ${response})`;
			}
		} else { // I am selling
			msg = `Direct: ${roomName} ${rightArrow} ${Math.round(amount)} ${order.resourceType} ${rightArrow} ` +
				  `${printRoomName(order.roomName!)} (+${cost}c)`;
			if (response != OK) {
				msg += ` (ERROR: ${response})`;
			}
		}
		this.notify(msg);
	}

	private notifyLastTickTransactions(): void {

		// Outgoing transactions are where I did the .deal() call
		for (const transaction of Game.market.outgoingTransactions) {
			if (transaction.time < Game.time - 1) break; // list is ordered by descending time

			if (transaction.order) { // if it was sold on the market
				let msg: string;
				const cost = Math.round(transaction.amount * transaction.order.price);
				// I am buying from another person's sell order
				if (transaction.order.type == ORDER_SELL) {
					const coststr = `[-${cost}c]`.padRight('[-10000c]'.length);
					msg = coststr + ` buy direct:  ${printRoomName(transaction.to, true)} ${leftArrow} ` +
						  `${transaction.amount} ${transaction.resourceType} ${leftArrow} ` +
						  `${printRoomName(transaction.from, true)} `;
					if (transaction.sender && transaction.recipient) {
						// const sender = transaction.sender.username; // should be me
						const recipient = transaction.recipient.username;
						msg += `(bought from: ${recipient})`;
					} else {
						msg += `(bought from: ???)`;
					}
				}
				// I am selling to another person's buy order
				else {
					const coststr = `[+${cost}c]`.padRight('[-10000c]'.length);
					msg = coststr + ` sell direct: ${printRoomName(transaction.from, true)} ${rightArrow} ` +
						  `${transaction.amount} ${transaction.resourceType} ${rightArrow} ` +
						  `${printRoomName(transaction.to, true)} `;
					if (transaction.sender && transaction.recipient) {
						// const sender = transaction.sender.username; // should be me
						const recipient = transaction.recipient.username;
						msg += `(sold to: ${recipient})`;
					} else {
						msg += `(sold to: ???)`;
					}
				}
				this.notify(msg);
			}
		}

		// Incoming transactions are where someone else did the .deal() call to my order
		for (const transaction of Game.market.incomingTransactions) {
			if (transaction.time < Game.time - 1) break; // list is ordered by descending time

			if (transaction.order) { // if it was sold on the market
				let msg: string;
				const cost = Math.round(transaction.amount * transaction.order.price);
				// Another person is fulfilling my buy order
				if (transaction.order.type == ORDER_BUY) {
					const coststr = `[-${cost}c]`.padRight('[-10000c]'.length);
					msg = coststr + ` buy order:   ${printRoomName(transaction.to, true)} ${leftArrow} ` +
						  `${transaction.amount} ${transaction.resourceType} ${leftArrow} ` +
						  `${printRoomName(transaction.from, true)} `;
					if (transaction.sender && transaction.recipient) {
						const sender = transaction.sender.username;
						// const recipient = transaction.recipient.username; // should be me
						msg += `(seller: ${sender})`;
					} else {
						msg += `(seller: ???)`;
					}
				}
				// Another person is buying from my sell order
				else {
					const coststr = `[+${cost}c]`.padRight('[-10000c]'.length);
					msg = coststr + ` sell order:  ${printRoomName(transaction.from, true)} ${rightArrow} ` +
						  `${transaction.amount} ${transaction.resourceType} ${rightArrow} ` +
						  `${printRoomName(transaction.to, true)} `;
					if (transaction.sender && transaction.recipient) {
						const sender = transaction.sender.username;
						// const recipient = transaction.recipient.username; // should be me
						msg += `(buyer: ${sender})`;
					} else {
						msg += `(buyer: ???)`;
					}
				}
				this.notify(msg);
			}
		}

	}


	/**
	 * Returns a list of orders you have already placed for this type for this resource.
	 * If roomName is undefined, count any of your orders; if roomName is specified, only return if order is in room
	 */
	getExistingOrders(type: ORDER_BUY | ORDER_SELL, resource: ResourceConstant | 'any', roomName?: string): Order[] {
		let orders: Order[];
		if (roomName) {
			orders = _.filter(Game.market.orders, order => order.type == type &&
														   (order.resourceType == resource || resource == 'any') &&
														   order.roomName == roomName);
			if (orders.length > 1 && resource != 'any') {
				log.error(`Multiple orders for ${resource} detected in ${printRoomName(roomName)}!`);
			}
		} else {
			orders = _.filter(Game.market.orders, order => order.type == type &&
														   (order.resourceType == resource || resource == 'any'));
		}
		return orders;
	}

	/**
	 * Returns whether an order is yours
	 */
	private isOrderMine(order: Order): boolean {
		return Game.rooms[order.roomName!] && Game.rooms[order.roomName!].my;
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
	private getPriceForBaseIngredients(resource: ResourceConstant/*, colony?: Colony*/): number {
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

	/**
	 * Computes a competitive market price to buy or sell resources at or to adjust existing orders to.
	 * Returns Infinity if sanity checks are not passed or if there is insufficient data to generate a buy price,
	 * in which case the items should not be sold.
	 */
	private computeCompetitivePrice(type: ORDER_SELL | ORDER_BUY, resource: ResourceConstant, room: string): number {

		// Find out how much all the ingredients to make this should cost
		const priceForBaseResources = this.getPriceForBaseIngredients(resource);
		if (priceForBaseResources == 0 || priceForBaseResources == Infinity) {
			log.error(`Cannot get base ingredient price for ${resource}!`);
			return Infinity;
		}

		// Get all orders for this resource and group by type
		const allOrdersOfResource = _.groupBy(Game.market.getAllOrders({resourceType: resource}), 'type');
		const allBuyOrders = allOrdersOfResource[ORDER_BUY];
		const allSellOrders = allOrdersOfResource[ORDER_SELL];

		// Find most competitive orders, ignoring small orders and orders which are mine
		const highestBuyOrder = maxBy(allBuyOrders, o => o.amount < 100 || this.isOrderMine(o) ? false : o.price);
		const lowestSellOrder = minBy(allSellOrders, o => o.amount < 100 || this.isOrderMine(o) ? false : o.price);
		if (!highestBuyOrder || !lowestSellOrder) {
			log.error(`No buy orders or no sell orders for ${resource}!`);
			return Infinity;
		}

		// Compute an adjustment factor based on how long it's been sitting on the market
		const adjustMagnitude = 0.05;
		let adjustment = 1;
		const existingOrder = _.first(this.getExistingOrders(ORDER_SELL, resource, room));
		if (existingOrder) {
			const timeOnMarket = Game.time - existingOrder.created;
			const orderDiscountTimescale = 100000; // should be less than the timeout value
			adjustment = (adjustment + timeOnMarket / orderDiscountTimescale) / 2;
		}

		// Compute the price, returning Infinity if sanity checks are not passed
		if (type == ORDER_SELL) { // if you are trying to sell a resource to buyers, undercut their prices a bit
			const discountFactor = 1 - adjustment * adjustMagnitude;
			const marketRate = Math.max(lowestSellOrder.price, highestBuyOrder.price * 1.1);
			const price = marketRate * discountFactor;
			// If the sell price is greater than the lowestSell order price, it might mean an opportunity for arbitrage
			if (price > lowestSellOrder.price) {
				// TODO
			}
			// It's not sensible to sell at a lower cost than what you paid to make it
			if (price < priceForBaseResources) {
				return Infinity;
			} else {
				return price;
			}
		} else { // if you are trying to buy a resource from sellers, offer a little bit more than market rate
			const outbidFactor = 1 + adjustment * adjustMagnitude;
			const marketRate = Math.min(highestBuyOrder.price, lowestSellOrder.price / 1.1);
			const price = marketRate * outbidFactor;
			// If the buy price is less than the highestBuy order price, it might mean an opportunity for arbitrage
			if (price < highestBuyOrder.price) {
				// TODO
			}
			// Don't pay >10x what ingredients cost - about 5.0c for XGHO2 based on March 2020 data
			const maxMarkupWillingToBuyFrom = 10;
			if (price > priceForBaseResources * maxMarkupWillingToBuyFrom) {
				return Infinity;
			} else {
				return price;
			}
		}

	}

	/**
	 * Create or maintain an order, extending and repricing as needed
	 */
	private maintainOrder(terminal: StructureTerminal, type: ORDER_SELL | ORDER_BUY,
						  resource: ResourceConstant, amount: number, opts: TradeOpts): number {

		// This is all somewhat expensive so only do this occasionally
		if (Game.time % 10 != 5) {
			return OK; // No action needed on these ticks
		}
		// Cap the amount based on the maximum you can make a buy/sell order with
		if (type == ORDER_SELL) {
			amount = Math.min(amount, TraderJoe.settings.market.orders.maxBuyOrderAmount);
		} else {
			amount = Math.min(amount, TraderJoe.settings.market.orders.maxSellOrderAmount);
		}
		// Wait until you accumulate more of the resource to order with bigger transactions
		const minAmount = type == ORDER_BUY ? TraderJoe.settings.market.orders.minBuyOrderAmount
											: TraderJoe.settings.market.orders.minSellOrderAmount;
		if (amount < minAmount && !opts.ignoreMinAmounts) {
			return NO_ACTION;
		}

		const existingOrder = _.first(this.getExistingOrders(type, resource, terminal.room.name));

		// Maintain an existing order
		if (existingOrder) {
			// Figure out if price should be changed - if the competitive price is now significantly different
			const price = this.computeCompetitivePrice(type, resource, terminal.room.name);
			if (price == Infinity || price == 0) {
				return ERR_NOT_ENOUGH_MARKET_DATA;
			}
			const ratio = existingOrder.price / price;
			const tolerance = 0.03; // might need to tune this, we'll see
			const normalFluctuation = (1 + tolerance > ratio && ratio > 1 - tolerance);

			// Extend the order if you need to sell more of the resource
			if (amount > existingOrder.remainingAmount && normalFluctuation) {
				const addAmount = amount - existingOrder.remainingAmount;
				// const ret = Game.market.extendOrder(existingOrder.id, addAmount); // TODO
				const ret = OK;
				this.notify(`${terminal.room.print}: extending ${type} order for ${resource} by ${addAmount}.` +
							` Response: ${ret}`);
				return ret;
			}

			// Small chance of changing the price if it's not competitive; don't do too often or you are high risk
			if (!normalFluctuation && Math.random() < 1 / 200) {
				// const ret = Game.market.changeOrderPrice(existingOrder.id, price); // TODO
				const ret = OK;
				this.notify(`${terminal.room.print}: updating ${type} order price for ${resource} from ` +
							`${existingOrder.price} to ${price}. Response: ${ret}`);
				return ret;
			}

			// No action needed
			return OK;
		}
		// Create a new order
		else {
			// Compute the buy or sell price
			const price = this.computeCompetitivePrice(type, resource, terminal.room.name);
			if (price == Infinity || price == 0) {
				return ERR_NOT_ENOUGH_MARKET_DATA;
			}

			// adjust the amount to only immediately list what you can afford; it can be extended later
			const brokersFee = price * amount * MARKET_FEE;
			if (Game.market.credits < brokersFee) {
				amount = amount * Game.market.credits / brokersFee * 0.9;
			}

			// Only place up to a certain amount of orders
			const existingOrdersForThis = this.getExistingOrders(type, resource);
			if (existingOrdersForThis.length < TraderJoe.settings.market.orders.maxOrdersForResource) {
				const params = {
					type        : type,
					resourceType: resource,
					price       : price,
					totalAmount : amount,
					roomName    : terminal.room.name
				};
				// const ret = Game.market.createOrder(params);
				const ret = OK;
				this.notify(`${terminal.room.print}: creating ${type} order for ${amount} ${resource} ` +
							`at price ${price.toFixed(4)}. Response: ${ret}`);
				return ret;
			} else {
				this.notify(`${terminal.room.print}: could not create ${type} order for ${amount} ${resource} - ` +
							`too many existing!`);
				return ERR_TOO_MANY_ORDERS_OF_TYPE;
			}
		}

	}

	private cleanOrders() {
		const ordersToClean = _.filter(Game.market.orders, order => {
			// Clean up inactive sell orders where you've sold everything
			if (order.type == ORDER_SELL && order.active == false && order.remainingAmount == 0) {
				return true;
			}
			// Clean up very old orders which are almost completed but which have some small amount remaining
			if (Game.time - order.created > TraderJoe.settings.market.orders.timeout
				&& order.remainingAmount < TraderJoe.settings.market.orders.cleanupAmount) {
				return true;
			}
			// Clean up orders placed in colonies which are no longer with us :(
			if (order.roomName && !Overmind.colonies[order.roomName]) {
				return true;
			}
		});
		for (const order of ordersToClean) {
			Game.market.cancelOrder(order.id);
		}
	}

	/**
	 * Buy resources directly from a seller using Game.market.deal() rather than making a buy order
	 */
	private buyDirectly(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
						opts: TradeOpts): number {
		// If terminal is on cooldown or just did something then skip
		if (!terminal.isReady) {
			return NO_ACTION; // don't return ERR_TIRED here because it doesn't signal an inability to buy
		}
		// Wait until you accumulate more of the resource to buy with bigger transactions
		if (amount < TraderJoe.settings.market.orders.minBuyDirectAmount && !opts.ignoreMinAmounts) {
			return NO_ACTION;
		}
		// If flexibleAmount is allowed, consider buying from orders which don't need the full amount
		const minAmount = opts.flexibleAmount ? Math.min(TraderJoe.settings.market.orders.minBuyDirectAmount, amount)
											  : amount;
		const validOrders = _.filter(Game.market.getAllOrders({resourceType: resource, type: ORDER_SELL}),
									 order => order.amount >= minAmount);

		// Find the cheapest order, minimizing by (buying price + marginal cost of transaction)
		const order = minBy(validOrders, order => order.price
												  + this.marginalTransactionPrice(order, terminal.room.name)
												  - order.amount / 1000000000); // last bit prioritizes biggest orders

		// If no valid order, notify a warning and return an error so it can be handled in .buy()
		if (!order) {
			this.notify(`No valid market order to buy from! Buy request: ${amount} ${resource} to ` +
						`${printRoomName(terminal.room.name)}`);
			return ERR_NO_ORDER_TO_BUY_FROM;
		}

		// Check that the buy price isn't too expensive
		const price = order.price + this.marginalTransactionPrice(order, terminal.room.name);
		const priceForBaseIngredients = this.getPriceForBaseIngredients(resource);
		const maxPriceWillingToPay = priceForBaseIngredients * (1.5 + Game.market.credits / 2e6);
		if (priceForBaseIngredients != Infinity && price > maxPriceWillingToPay) {
			this.notify(`Buy order is too expenisive! Buy request: ${amount} ${resource} to ` +
						`${printRoomName(terminal.room.name)}, cost of best order: ${price}`);
			return ERR_BUY_DIRECT_PRICE_TOO_EXPENSIVE;
		}

		// Do the deal
		const buyAmount = Math.min(order.amount, amount);
		const transactionCost = Game.market.calcTransactionCost(buyAmount, terminal.room.name, order.roomName!);
		if (terminal.store[RESOURCE_ENERGY] >= transactionCost) {
			const response = Game.market.deal(order.id, buyAmount, terminal.room.name);
			this.logTransaction(order, terminal.room.name, amount, response);
			return response;
		} else {
			return ERR_INSUFFICIENT_ENERGY_IN_TERMINAL;
		}
	}

	/**
	 * Sell resources directly to a buyer using Game.market.deal() rather than making a sell order
	 */
	private sellDirectly(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
						 opts: TradeOpts): number {
		// If terminal is on cooldown or just did something then skip
		if (!terminal.isReady) {
			return NO_ACTION; // don't return ERR_TIRED here because it doesn't signal an inability to sell
		}
		// Wait until you accumulate more of the resource to sell with bigger transactions
		if (amount < TraderJoe.settings.market.orders.minSellDirectAmount && !opts.ignoreMinAmounts) {
			return NO_ACTION;
		}
		// If flexibleAmount is allowed, consider selling to orders which don't need the full amount
		const minAmount = opts.flexibleAmount ? Math.min(amount, TraderJoe.settings.market.orders.minSellDirectAmount)
											  : amount;
		const validOrders = _.filter(Game.market.getAllOrders({resourceType: resource, type: ORDER_BUY}),
									 order => order.amount >= minAmount);

		// Find the best order, maximizing by (buying price - marginal loss from transaction)
		const order = maxBy(validOrders, order => order.price
												  - this.marginalTransactionPrice(order, terminal.room.name)
												  + order.amount / 1000000000); // last bit prioritizes biggest orders

		// If you find a valid order, execute it
		if (order) {
			let sellAmount = Math.min(order.amount, amount,
									  terminal.store[resource],
									  TraderJoe.settings.market.orders.maxSellDirectAmount);
			const transactionCost = Game.market.calcTransactionCost(sellAmount, terminal.room.name, order.roomName!);
			if (resource == RESOURCE_ENERGY) { // if we're selling energy, make sure we have amount + cost
				if (amount + transactionCost > terminal.store[RESOURCE_ENERGY]) {
					sellAmount -= transactionCost;
					if (sellAmount <= 0) {
						return ERR_INSUFFICIENT_ENERGY_IN_TERMINAL;
					}
				}
			}
			if (terminal.store[RESOURCE_ENERGY] >= transactionCost) {
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
			return ERR_NO_ORDER_TO_SELL_TO;
		}
	}

	/**
	 * Buy a resource on the market, either through a buy order or directly (usually direct=true will be used)
	 */
	buy(terminal: StructureTerminal, resource: ResourceConstant, amount: number, opts: TradeOpts = {}): number {

		_.defaults(opts, defaultTradeOpts);

		if (Game.market.credits < TraderJoe.settings.market.credits.canBuyAbove) {
			log.error(`Credits insufficient to buy resources; shouldn't be making this TradeNetwork.buy() request!`);
			return ERR_CREDIT_THRESHOLDS;
		}

		if (Game.market.credits < TraderJoe.settings.market.credits.canBuyBoostsAbove && Abathur.isBoost(resource)) {
			log.error(`Credits insufficient to buy boosts; shouldn't be making this TradeNetwork.buy() request!`);
			return ERR_CREDIT_THRESHOLDS;
		}

		if (Game.market.credits < TraderJoe.settings.market.credits.canBuyEnergyAbove && resource == RESOURCE_ENERGY) {
			log.error(`Credits insufficient to buy energy; shouldn't be making this TradeNetwork.buy() request!`);
			return ERR_CREDIT_THRESHOLDS;
		}

		// If you don't have a lot of credits or preferDirect==true, try to sell directly to an existing buy order
		if (opts.preferDirect && this.getExistingOrders(ORDER_BUY, resource, terminal.room.name).length == 0) {
			const result = this.buyDirectly(terminal, resource, amount, opts);
			if (result != ERR_NO_ORDER_TO_BUY_FROM) {
				return result;
			}
		}

		// Fallthrough - if not preferDirect or if existing order or if there's no orders to buy from then make order
		const result = this.maintainOrder(terminal, ORDER_BUY, resource, amount, opts);
		return result;
	}

	/**
	 * Sell a resource on the market, either through a sell order or directly
	 */
	sell(terminal: StructureTerminal, resource: ResourceConstant, amount: number, opts: TradeOpts = {}): number {

		_.defaults(opts, defaultTradeOpts);

		if (amount > terminal.store[resource]) {
			// log.warning(`Terminal in ${printRoomName(terminal.room.name)} ` +
			// 			`doesn't have ${amount} ${resource} in store!`);
			amount = terminal.store[resource];
		}

		// If you don't have a lot of credits or preferDirect==true, try to sell directly to an existing buy order
		if (Game.market.credits < TraderJoe.settings.market.credits.mustSellDirectBelow || opts.preferDirect) {
			if (this.getExistingOrders(ORDER_SELL, resource, terminal.room.name).length == 0) {
				const result = this.sellDirectly(terminal, resource, amount, opts);
				if (result != ERR_NO_ORDER_TO_SELL_TO) {
					return result;
				}
			}
		}

		// If you have enough credits or if there are no buy orders to sell to, create / maintain a sell order
		if (Game.market.credits >= TraderJoe.settings.market.credits.canPlaceSellOrdersAbove) {
			const result = this.maintainOrder(terminal, ORDER_SELL, resource, amount, opts);
			return result;
		} else {
			return ERR_CREDIT_THRESHOLDS;
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
			this.cleanOrders();
		}

		this.notifyLastTickTransactions();

		if (this.notifications.length > 0) {
			this.notifications.sort();
			log.info(`Trade network activity: ` + alignedNewline + this.notifications.join(alignedNewline));
		}

		this.recordStats();
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

}
