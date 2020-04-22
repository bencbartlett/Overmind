import {assimilationLocked} from '../assimilation/decorator';
import {getAllColonies} from '../Colony';
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
	energyPrice: {
		sell: number;
		buy: number;
	};
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
	debug?: boolean;
	cache: MarketCache;
	canceledOrders: Order[];
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

const getDefaultTraderMemory: () => TraderMemory = () => ({
	cache         : {
		sell       : {},
		buy        : {},
		energyPrice: {
			sell: 0.1,
			buy : 0.1,
		},
		history    : {},
		tick       : 0,
	},
	canceledOrders: []
});

const getDefaultTraderStats: () => TraderStats = () => ({
	credits: 0,
	bought : {},
	sold   : {},
});

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
export const ERR_SELL_DIRECT_PRICE_TOO_LOW = -106;
export const ERR_BUY_DIRECT_PRICE_TOO_HIGH = -107;
export const ERR_CREDIT_THRESHOLDS = -108;
export const ERR_DONT_BUY_REACTION_INTERMEDIATES = -109;
export const ERR_DRY_RUN_ONLY_SUPPORTS_DIRECT_TRANSACTIONS = -110;

const defaultTradeOpts: TradeOpts = {
	preferDirect              : false,
	flexibleAmount            : true,
	ignoreMinAmounts          : false,
	ignorePriceChecksForDirect: false,
	dryRun                    : false,
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
			resources: {
				allowBuyT1T2boosts: false, // the market for T1/T2 boosts is unstable; disallow buying this by default
			},
			credits  : {
				mustSellDirectBelow    : 5000,
				canPlaceSellOrdersAbove: 2000,
				canBuyAbove            : 10000,
				canBuyPassivelyAbove   : 50000,
				canBuyBoostsAbove      : 5 * Math.max(RESERVE_CREDITS, 1e5),
				canBuyEnergyAbove      : 10 * Math.max(RESERVE_CREDITS, 1e5),
			},
			orders   : {
				timeout               : 500000, // Remove orders after this many ticks if remaining amount < cleanupAmount
				cleanupAmount         : 100,	  // RemainingAmount threshold to remove expiring orders
				maxEnergySellOrders   : 5,
				maxEnergyBuyOrders    : 5,
				maxOrdersPlacedPerTick: 7,
				maxOrdersForResource  : 20,
				minSellOrderAmount    : 1000,
				maxSellOrderAmount    : 25000,
				minSellDirectAmount   : 250,
				maxSellDirectAmount   : 10000,
				minBuyOrderAmount     : 250,
				maxBuyOrderAmount     : 25000,
				minBuyDirectAmount    : 500,
				maxBuyDirectAmount    : 10000,
			}
		},
	};

	name: string;
	memory: TraderMemory;
	stats: TraderStats;

	private notifications: string[];
	private ordersPlacedThisTick: number;

	constructor() {
		this.name = 'TradeNetwork';
		this.refresh();
	}

	refresh() {
		this.memory = Mem.wrap(Memory.Overmind, 'trader', getDefaultTraderMemory);
		this.stats = Mem.wrap(Memory.stats.persistent, 'trader', getDefaultTraderStats);
		this.notifications = [];
		this.ordersPlacedThisTick = 0;
	}

	private debug(...args: any[]) {
		if (this.memory.debug) {
			log.alert('TradeNetwork:', args);
		}
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
		this.debug('Building market cache');
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
		this.debug('Building market history cache');
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

	/**
	 * Computes the effective price of energy accounting for transfer costs
	 */
	private computeEffectiveEnergyPrices(): void {
		const energyOrders = _(Game.market.getAllOrders({resourceType: RESOURCE_ENERGY}))
			.filter(order => order.amount >= 5000)
			.groupBy(order => order.type).value();
		const sellOrders = energyOrders[ORDER_SELL];
		const buyOrders = energyOrders[ORDER_BUY];

		for (const colony of _.sample(getAllColonies(), 5)) {
			const room = colony.room.name;
			const sellDirectPrice = maxBy(buyOrders, order => order.price - this.marginalTransactionPrice(order, room));
			const buyDirectPrice = minBy(sellOrders, order => order.price + this.marginalTransactionPrice(order, room));
			const sellOrderPrice = this.computeCompetitivePrice(ORDER_SELL, RESOURCE_ENERGY, room);
			const buyOrderPrice = this.computeCompetitivePrice(ORDER_BUY, RESOURCE_ENERGY, room);
		}

		// TODO: this implicitly requires knonwledge of energy price for this.marginalTransactionPrice() -> problematic?

	}

	private invalidateMarketCache(): void {
		this.memory.cache = getDefaultTraderMemory().cache;
	}

	// /**
	//  * Pretty-prints transaction information in the console
	//  */
	// private logTransaction(order: Order, terminalRoomName: string, amount: number, response: number): void {
	// 	const cost = (order.price * amount).toFixed(0);
	// 	const fee = order.roomName ? Game.market.calcTransactionCost(amount, order.roomName, terminalRoomName) : 0;
	// 	const roomName = printRoomName(terminalRoomName, true);
	// 	let msg: string;
	// 	if (order.type == ORDER_SELL) { // I am buying
	// 		msg = `Direct: ${roomName} ${leftArrow} ${Math.round(amount)} ${order.resourceType} ${leftArrow} ` +
	// 			  `${printRoomName(order.roomName!)} (-${cost}c)`;
	// 		if (response != OK) {
	// 			msg += ` (ERROR: ${response})`;
	// 		}
	// 	} else { // I am selling
	// 		msg = `Direct: ${roomName} ${rightArrow} ${Math.round(amount)} ${order.resourceType} ${rightArrow} ` +
	// 			  `${printRoomName(order.roomName!)} (+${cost}c)`;
	// 		if (response != OK) {
	// 			msg += ` (ERROR: ${response})`;
	// 		}
	// 	}
	// 	// this.notify(msg); // use the transactions from the ledger instead
	// }


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
			// Average distance between any two rooms is 25 since the map wraps, which has 56% transaction price, so
			// energy is 44% what is is normally. This is a bit pessimistic, so let's bump it to 55%, which currently
			// is what computeCompetitivePrice(sell, energy) is telling me it should be around...
			const energyPriceGuess = 0.55 * this.memory.cache.history.energy.avg14;
			const energyToCreditMultiplier = Math.min(energyPriceGuess, 0.1);
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
		const highestBuyOrder = maxBy(allBuyOrders, o =>
			o.amount < 100 || this.isOrderMine(o) ? false : o.price - this.marginalTransactionPrice(o, room));
		const lowestSellOrder = minBy(allSellOrders, o =>
			o.amount < 100 || this.isOrderMine(o) ? false : o.price + this.marginalTransactionPrice(o, room));
		if (!highestBuyOrder || !lowestSellOrder) {
			log.error(`No buy orders or no sell orders for ${resource}!`);
			return Infinity;
		}

		// Compute an adjustment factor based on how long it's been sitting on the market
		const adjustMagnitude = 0.1;
		let adjustment = 1;
		const existingOrder = _.first(this.getExistingOrders(ORDER_SELL, resource, room));
		if (existingOrder) {
			const timeOnMarket = Game.time - existingOrder.created;
			const orderDiscountTimescale = 50000; // order will change by adjustMagnitude percent every this many ticks
			adjustment = (adjustment + timeOnMarket / orderDiscountTimescale) / 2;
		}

		// Compute the price, returning Infinity if sanity checks are not passed
		if (type == ORDER_SELL) { // if you are trying to sell a resource to buyers, undercut their prices a bit
			const discountFactor = 1 - adjustment * adjustMagnitude;
			const marketRate = Math.max(lowestSellOrder.price, highestBuyOrder.price);
			const price = marketRate * discountFactor;
			this.debug(`Candidate price to ${type} ${resource} in ${printRoomName(room)}: ${price}`);
			// If the sell price is greater than the lowestSell order price, it might mean an opportunity for arbitrage
			if (price > lowestSellOrder.price) {
				// TODO
			}
			// It's not sensible to sell at a lower cost than what you paid to make it
			if ((!Abathur.isBaseMineral(resource) && price < priceForBaseResources) ||
				(Abathur.isBaseMineral(resource) && price < priceForBaseResources / 2) || // can sell base below market
				price < 0) {
				return Infinity;
			} else {
				return price;
			}
		} else { // if you are trying to buy a resource from sellers, offer a little bit more than market rate
			const outbidFactor = 1 + adjustment * adjustMagnitude;
			const marketRate = Math.min(highestBuyOrder.price, lowestSellOrder.price);
			const price = marketRate * outbidFactor;
			this.debug(`Candidate price to ${type} ${resource} in ${printRoomName(room)}: ${price}`);
			// If the buy price is less than the highestBuy order price, it might mean an opportunity for arbitrage
			if (price < highestBuyOrder.price) {
				// TODO
			}
			// Don't pay >10x what ingredients cost - about 3.0c for XGHO2 based on March 2020 data
			const maxMarkupWillingToBuyFrom = 3;
			if (price > priceForBaseResources * maxMarkupWillingToBuyFrom) {
				return Infinity;
			} else {
				return price;
			}
		}

	}

	ordersProcessedThisTick(): boolean {
		return Game.time % 10 == 5;
	}

	/**
	 * Create or maintain an order, extending and repricing as needed
	 */
	private maintainOrder(terminal: StructureTerminal, type: ORDER_SELL | ORDER_BUY,
						  resource: ResourceConstant, amount: number, opts: TradeOpts): number {
		this.debug(`maintain ${type} order for ${terminal.room.print}: ${amount} ${resource}`);

		// This is all somewhat expensive so only do this occasionally
		if (!this.ordersProcessedThisTick()) {
			return OK; // No action needed on these ticks; we'll pretend this works OK
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
			this.debug(`amount ${amount} less than min amount ${minAmount}; no action taken`);
			return NO_ACTION;
		}

		const existingOrder = _.first(this.getExistingOrders(type, resource, terminal.room.name));

		// Maintain an existing order
		if (existingOrder) {
			// Figure out if price should be changed - if the competitive price is now significantly different
			const price = +this.computeCompetitivePrice(type, resource, terminal.room.name)
							   .toFixed(3); // market only allows for 3 decimal places of precision
			if (price == Infinity || price == 0) {
				log.warning(`TradeNetwork: sanity checks not passed to handle existing ${type} order ${resource} ` +
							`in ${printRoomName(terminal.room.name)}!`);
				return ERR_NOT_ENOUGH_MARKET_DATA;
			}
			const ratio = existingOrder.price / price;
			const tolerance = 0.03; // might need to tune this, we'll see
			const normalFluctuation = (1 + tolerance > ratio && ratio > 1 - tolerance);

			// Extend the order if you need to sell more of the resource
			if (amount > existingOrder.remainingAmount && normalFluctuation) {
				const addAmount = amount - existingOrder.remainingAmount;
				const ret = Game.market.extendOrder(existingOrder.id, addAmount);
				this.notify(`${terminal.room.print}: extending ${type} order for ${resource} by ${addAmount}.` +
							` Response: ${ret}`);
				return ret;
			}

			// Small chance of changing the price if it's not competitive; don't do too often or you are high risk
			if (!normalFluctuation && Math.random() < 1 / 2000) {
				const ret = Game.market.changeOrderPrice(existingOrder.id, price);
				this.notify(`${terminal.room.print}: changing ${type} order price for ${resource} from ` +
							`${existingOrder.price} to ${price}. Response: ${ret}`);
				return ret;
			}

			// No action needed
			return OK;
		}
		// Create a new order
		else {
			// Put a cap on the number of orders you can create per tick
			if (this.ordersPlacedThisTick > TraderJoe.settings.market.orders.maxOrdersPlacedPerTick) {
				return NO_ACTION;
			}

			// Only place up to a certain amount of orders
			const existingOrdersForThis = this.getExistingOrders(type, resource);
			if (existingOrdersForThis.length > TraderJoe.settings.market.orders.maxOrdersForResource) {
				this.notify(`${printRoomName(terminal.room.name, true)}: could not create ${type} order for ` +
							`${Math.round(amount)} ${resource} - too many existing!`);
				return ERR_TOO_MANY_ORDERS_OF_TYPE;
			}

			// Compute the buy or sell price
			const price = +this.computeCompetitivePrice(type, resource, terminal.room.name)
							   .toFixed(3); // market only allows for 3 decimal places of precision
			if (price == Infinity || price == 0) {
				log.warning(`TradeNetwork: sanity checks not passed to create ${type} order ${resource} in ` +
							`${printRoomName(terminal.room.name)}!`);
				return ERR_NOT_ENOUGH_MARKET_DATA;
			}

			// adjust the amount to only immediately list what you can afford; it can be extended later
			const brokersFee = price * amount * MARKET_FEE;
			if (Game.market.credits < brokersFee) {
				amount = amount * Game.market.credits / brokersFee * 0.9;
			}

			// Create the order
			const params = {
				type        : type,
				resourceType: resource,
				price       : price,
				totalAmount : amount,
				roomName    : terminal.room.name
			};
			const ret = Game.market.createOrder(params);
			let msg = '';
			if (type == ORDER_BUY) {
				msg += `${printRoomName(terminal.room.name, true)} creating buy order:  ` +
					   `${Math.round(amount)} ${resource} at price ${price.toFixed(4)}`;
			} else {
				msg += `${printRoomName(terminal.room.name, true)} creating sell order: ` +
					   `${Math.round(amount)} ${resource} at price ${price.toFixed(4)}`;
			}
			if (ret == OK) {
				this.ordersPlacedThisTick++;
			} else {
				msg += ` ERROR: ${ret}`;
			}
			this.debug(msg);
			this.notify(msg);
			return ret;

		}

	}

	private cleanOrders() {
		const ordersToClean = _.filter(Game.market.orders, order => {
			// Clean up inactive orders where you've bought/sold everything
			if (order.active == false && order.remainingAmount == 0) {
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
			const ret = Game.market.cancelOrder(order.id);
			if (ret == OK) {
				// Add to canceled orders for tracking
				this.notify(`Cleaning ${order.type} order for ${order.totalAmount} ${order.resourceType}. ` +
							`Order lifetime: ${Game.time - order.created}`);
				(<any>order).lifetime = Game.time - order.created;
				this.memory.canceledOrders.push(order);
				if (this.memory.canceledOrders.length > 300) {
					this.memory.canceledOrders.shift(); // only keep this many orders in memory
				}
			}
		}
	}

	/**
	 * Buy resources directly from a seller using Game.market.deal() rather than making a buy order
	 */
	private buyDirect(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
					  opts: TradeOpts): number {
		this.debug(`buyDirect for ${terminal.room.print}: ${amount} ${resource}`);
		// If terminal is on cooldown or just did something then skip
		if (!terminal.isReady && !opts.dryRun) {
			return NO_ACTION; // don't return ERR_TIRED here because it doesn't signal an inability to buy
		}
		// Wait until you accumulate more of the resource to buy with bigger transactions
		if (amount < TraderJoe.settings.market.orders.minBuyDirectAmount && !opts.ignoreMinAmounts && !opts.dryRun) {
			return NO_ACTION;
		}

		// Can only buy what you are allowed to and have space for
		amount = Math.min(amount, terminal.store.getFreeCapacity(),
						  TraderJoe.settings.market.orders.maxBuyDirectAmount);

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
			if (!opts.dryRun) {
				this.notify(`No valid market order to buy from! Buy request: ${amount} ${resource} to ` +
							`${printRoomName(terminal.room.name)}`);
			}
			return ERR_NO_ORDER_TO_BUY_FROM;
		}

		// Check that the buy price isn't too expensive
		const adjustedPrice = order.price + this.marginalTransactionPrice(order, terminal.room.name);
		const priceForBaseIngredients = this.getPriceForBaseIngredients(resource);
		const maxPriceWillingToPay = priceForBaseIngredients * (1.5 + Game.market.credits / 2e6);
		this.debug(`Price: ${order.price}, Adjusted: ${adjustedPrice}, BaseCost: ${priceForBaseIngredients}, ` +
				   `Max: ${maxPriceWillingToPay}`);
		if (priceForBaseIngredients == Infinity
			|| (adjustedPrice > maxPriceWillingToPay && !opts.ignorePriceChecksForDirect)
			|| adjustedPrice > 100) { // never buy above an absurd threshold, regardless of opts.ignorePriceChecks
			if (!opts.dryRun) {
				this.notify(`Buy direct call is too expenisive! Buy request: ${amount} ${resource} to ` +
							`${printRoomName(terminal.room.name)}, adjusted price of best order: ` +
							`${adjustedPrice.toFixed(4)}`);
			}
			return ERR_BUY_DIRECT_PRICE_TOO_HIGH;
		}

		// Do the deal
		const buyAmount = Math.min(order.amount, amount);
		const transactionCost = Game.market.calcTransactionCost(buyAmount, terminal.room.name, order.roomName!);
		if (terminal.store[RESOURCE_ENERGY] >= transactionCost) {
			// If this is a dry run just check that you have enough credits
			if (opts.dryRun) {
				const haveEnoughCredits = Game.market.credits >= buyAmount * order.price;
				return haveEnoughCredits ? OK : ERR_NOT_ENOUGH_RESOURCES;
			}
			// Otherwise make the deal
			const response = Game.market.deal(order.id, buyAmount, terminal.room.name);
			this.debug(`buyDirect executed for ${terminal.room.print}: ${buyAmount} ${resource} (${response})`);
			// this.logTransaction(order, terminal.room.name, amount, response);
			return response;
		} else {
			return ERR_INSUFFICIENT_ENERGY_IN_TERMINAL;
		}
	}

	/**
	 * Sell resources directly to a buyer using Game.market.deal() rather than making a sell order
	 */
	private sellDirect(terminal: StructureTerminal, resource: ResourceConstant, amount: number,
					   opts: TradeOpts): number {
		this.debug(`sellDirect for ${terminal.room.print}: ${amount} ${resource}`);
		// If terminal is on cooldown or just did something then skip
		if (!terminal.isReady && !opts.dryRun) {
			return NO_ACTION; // don't return ERR_TIRED here because it doesn't signal an inability to sell
		}
		// Wait until you accumulate more of the resource to sell with bigger transactions
		if (amount < TraderJoe.settings.market.orders.minSellDirectAmount && !opts.ignoreMinAmounts && !opts.dryRun) {
			return NO_ACTION;
		}

		// Can only sell what you have in store and are allowed to sell
		amount = Math.min(amount, terminal.store[resource], TraderJoe.settings.market.orders.maxSellDirectAmount);

		// If flexibleAmount is allowed, consider selling to orders which don't need the full amount
		const minAmount = opts.flexibleAmount ? Math.min(amount, TraderJoe.settings.market.orders.minSellDirectAmount)
											  : amount;
		const validOrders = _.filter(Game.market.getAllOrders({resourceType: resource, type: ORDER_BUY}),
									 order => order.amount >= minAmount);

		// Find the best order, maximizing by (buying price - marginal loss from transaction)
		const order = maxBy(validOrders, order => order.price
												  - this.marginalTransactionPrice(order, terminal.room.name)
												  + order.amount / 1000000000); // last bit prioritizes biggest orders

		// If no order found, notify a warning and return an error so it can be handled in .sell()
		if (!order) {
			if (!opts.dryRun) {
				this.notify(`No valid market order to sell to! Sell request: ${amount} ${resource} from ` +
							`${printRoomName(terminal.room.name)}`);
			}
			return ERR_NO_ORDER_TO_SELL_TO;
		}

		// Check that the sell price isn't too expensive
		const adjustedPrice = order.price - this.marginalTransactionPrice(order, terminal.room.name);
		const priceForBaseIngredients = this.getPriceForBaseIngredients(resource);
		const minPriceWillingToSell = .5 * priceForBaseIngredients;
		this.debug(`Price: ${order.price}, Adjusted: ${adjustedPrice}, BaseCost: ${priceForBaseIngredients}, ` +
				   `Min: ${minPriceWillingToSell}`);
		if (priceForBaseIngredients == Infinity
			|| (adjustedPrice < minPriceWillingToSell && !opts.ignorePriceChecksForDirect)
			|| adjustedPrice < 0) { // never sell if it will be a net negative, regardless of opts.ignorePriceChecks
			if (!opts.dryRun) {
				this.notify(`Sell direct call is too cheap! Sell request: ${amount} ${resource} from ` +
							`${printRoomName(terminal.room.name)}, adjusted price of best order: ` +
							`${adjustedPrice}`);
			}
			return ERR_SELL_DIRECT_PRICE_TOO_LOW;
		}

		let sellAmount = Math.min(order.amount, amount);
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
			// If this is a dry run we should be able to execute the deal by now, so just return OK
			if (opts.dryRun) {
				return OK;
			}
			// Otherwise do the deal
			const response = Game.market.deal(order.id, sellAmount, terminal.room.name);
			this.debug(`sellDirect executed for ${terminal.room.print}: ${sellAmount} ${resource} (${response})`);
			// this.logTransaction(order, terminal.room.name, amount, response);
			return response;
		} else {
			return ERR_INSUFFICIENT_ENERGY_IN_TERMINAL;
		}
	}

	/**
	 * Buy a resource on the market, either through a buy order or directly (usually direct=true will be used)
	 */
	buy(terminal: StructureTerminal, resource: ResourceConstant, amount: number, opts: TradeOpts = {}): number {

		_.defaults(opts, defaultTradeOpts);

		if (Game.market.credits < TraderJoe.settings.market.credits.canBuyAbove) {
			log.error(`Credits insufficient to buy resource ${amount} ${resource} to ${terminal.room.print}; ` +
					  `shouldn't be making this TradeNetwork.buy() request!`);
			return ERR_CREDIT_THRESHOLDS;
		}

		if (Game.market.credits < TraderJoe.settings.market.credits.canBuyBoostsAbove && Abathur.isBoost(resource)) {
			log.error(`Credits insufficient to buy boost ${amount} ${resource} to ${terminal.room.print}; ` +
					  `shouldn't be making this TradeNetwork.buy() request!`);
			return ERR_CREDIT_THRESHOLDS;
		}

		if (Game.market.credits < TraderJoe.settings.market.credits.canBuyEnergyAbove && resource == RESOURCE_ENERGY) {
			log.error(`Credits insufficient to buy ${amount} energy to ${terminal.room.print}; ` +
					  `shouldn't be making this TradeNetwork.buy() request!`);
			return ERR_CREDIT_THRESHOLDS;
		}

		if (Abathur.isIntermediateReactant(resource) || resource == RESOURCE_GHODIUM) {
			log.error(`Shouldn't request reaction intermediate ${amount} ${resource} to ${terminal.room.print}!`);
			return ERR_DONT_BUY_REACTION_INTERMEDIATES;
		}

		// If you don't have a lot of credits or preferDirect==true, try to sell directly to an existing buy order
		if (opts.preferDirect && this.getExistingOrders(ORDER_BUY, resource, terminal.room.name).length == 0) {
			const result = this.buyDirect(terminal, resource, amount, opts);
			if (result != ERR_NO_ORDER_TO_BUY_FROM && result != ERR_BUY_DIRECT_PRICE_TOO_HIGH) {
				return result;
			}
			this.notify(`Buy direct request: ${amount} ${resource} to ${printRoomName(terminal.room.name)} ` +
						`was unsuccessful; allowing fallthrough to TradeNetwork.maintainOrder()`);
		}

		if (opts.dryRun) {
			return ERR_DRY_RUN_ONLY_SUPPORTS_DIRECT_TRANSACTIONS;
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


		// If you don't have a lot of credits or preferDirect==true, try to sell directly to an existing buy order
		if (opts.preferDirect || Game.market.credits < TraderJoe.settings.market.credits.mustSellDirectBelow) {
			if (this.getExistingOrders(ORDER_SELL, resource, terminal.room.name).length == 0) {
				const result = this.sellDirect(terminal, resource, amount, opts);
				if (result != ERR_NO_ORDER_TO_SELL_TO && result != ERR_SELL_DIRECT_PRICE_TOO_LOW) {
					return result; // if there's nowhere to sensibly sell, allow creating an order
				}
				this.notify(`Sell direct request: ${amount} ${resource} from ${printRoomName(terminal.room.name)} ` +
							`was unsuccessful; allowing fallthrough to TradeNetwork.maintainOrder()`);
			}
		}

		if (opts.dryRun) {
			return ERR_DRY_RUN_ONLY_SUPPORTS_DIRECT_TRANSACTIONS;
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


	private notifyLastTickTransactions(): void {

		// Outgoing transactions are where I sent the resource
		for (const transaction of Game.market.outgoingTransactions) {
			if (transaction.time < Game.time - 1) break; // list is ordered by descending time

			if (transaction.order) { // if it was sold on the market
				let msg: string;
				const cost = (transaction.amount * transaction.order.price).toFixed(2);
				// I am selling to another person's buy order
				if (transaction.order.type == ORDER_BUY) {
					const coststr = `[+${cost}c]`.padRight('[-10000.00c]'.length);
					msg = coststr + ` sell direct: ${printRoomName(transaction.to, true)} ${leftArrow} ` +
						  `${transaction.amount} ${transaction.resourceType} ${leftArrow} ` +
						  `${printRoomName(transaction.from, true)} `;
					if (transaction.sender && transaction.recipient) {
						// const sender = transaction.sender.username; // should be me
						const recipient = transaction.recipient.username;
						msg += `(sold to: ${recipient})`;
					} else {
						msg += `(sold to: ???)`;
					}
				}
				// Someone else is buying from by sell order
				else {
					const coststr = `[+${cost}c]`.padRight('[-10000.00c]'.length);
					msg = coststr + ` sell order: ${printRoomName(transaction.from, true)} ${rightArrow} ` +
						  `${transaction.amount} ${transaction.resourceType} ${rightArrow} ` +
						  `${printRoomName(transaction.to, true)} `;
					if (transaction.sender && transaction.recipient) {
						// const sender = transaction.sender.username; // should be me
						const recipient = transaction.recipient.username;
						msg += `(buyer: ${recipient})`;
					} else {
						msg += `(buyer: ???)`;
					}
				}
				this.notify(msg);
			}
		}

		// Incoming transactions are where I received the resource
		for (const transaction of Game.market.incomingTransactions) {
			if (transaction.time < Game.time - 1) break; // list is ordered by descending time

			if (transaction.order) { // if it was sold on the market
				let msg: string;
				const cost = (transaction.amount * transaction.order.price).toFixed(2);
				// I am receiving resources from a direct purchase of someone else's sell order
				if (transaction.order.type == ORDER_SELL) {
					const coststr = `[-${cost}c]`.padRight('[-10000.00c]'.length);
					msg = coststr + ` buy direct: ${printRoomName(transaction.to, true)} ${leftArrow} ` +
						  `${transaction.amount} ${transaction.resourceType} ${leftArrow} ` +
						  `${printRoomName(transaction.from, true)} `;
					if (transaction.sender && transaction.recipient) {
						const sender = transaction.sender.username;
						// const recipient = transaction.recipient.username; // should be me
						msg += `(bought from: ${sender})`;
					} else {
						msg += `(bought from: ???)`;
					}
				}
				// Another person is selling to my buy order
				else {
					const coststr = `[-${cost}c]`.padRight('[-10000.00c]'.length);
					msg = coststr + ` buy order: ${printRoomName(transaction.from, true)} ${rightArrow} ` +
						  `${transaction.amount} ${transaction.resourceType} ${rightArrow} ` +
						  `${printRoomName(transaction.to, true)} `;
					if (transaction.sender && transaction.recipient) {
						const sender = transaction.sender.username;
						// const recipient = transaction.recipient.username; // should be me
						msg += `(seller: ${sender})`;
					} else {
						msg += `(seller: ???)`;
					}
				}
				this.notify(msg);
			}
		}

	}

	/**
	 * Look through transactions happening on the previous tick and record stats
	 */
	private recordStats(): void {
		this.stats.credits = Game.market.credits;
		const lastTick = Game.time - 1;
		// Incoming transactions
		for (const transaction of Game.market.incomingTransactions) {
			if (transaction.time < lastTick) {
				break; // only look at things from last tick
			} else {
				if (transaction.order) {

					const resourceType = transaction.resourceType;
					const amount = transaction.amount;
					const price = transaction.order.price;
					this.stats.bought[resourceType] = this.stats.bought[resourceType] || {amount: 0, credits: 0};
					this.stats.bought[resourceType].amount += amount;
					this.stats.bought[resourceType].credits += amount * price;
				}
			}
		}
		// Outgoing transactions
		for (const transaction of Game.market.outgoingTransactions) {
			if (transaction.time < lastTick) {
				break; // only look at things from last tick
			} else {
				if (transaction.order) {
					const resourceType = transaction.resourceType;
					const amount = transaction.amount;
					const price = transaction.order.price;
					this.stats.sold[resourceType] = this.stats.sold[resourceType] || {amount: 0, credits: 0};
					this.stats.sold[resourceType].amount += amount;
					this.stats.sold[resourceType].credits += amount * price;
				}
			}
		}
	}

}
