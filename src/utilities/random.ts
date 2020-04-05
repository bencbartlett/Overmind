/**
 * Generates a random integer between [low, high] inclusive
 */
export function randint(low: number, high: number): number {
	return low + Math.floor(Math.random() * (high - low + 1));
}
