/**
 * Generates a random integer between [low, high] inclusive
 */
export function randint(low: number, high: number): number {
	return low + Math.floor(Math.random() * (high - low + 1));
}

/**
 * Flips a coin with probability p
 */
export function p(probability: number): boolean {
	return Math.random() < probability;
}

/**
 * Flips a coin with probability p * (bucket / bucketMax)
 */
export function pBucket(maxProbability: number): boolean {
	return Math.random() < maxProbability * Game.cpu.bucket / 10000;
}

/**
 * Samples from a normal distribution with mean = 0 and variance = 1 using the Box-Muller transform
 */
export function normal(): number {
	let x = 0;
	let y = 0;
	while (x === 0) x = Math.random(); // convert [0,1) to (0,1)
	while (y === 0) y = Math.random(); // convert [0,1) to (0,1)
	return Math.sqrt(-2.0 * Math.log(x)) * Math.cos(2.0 * Math.PI * y);
}
