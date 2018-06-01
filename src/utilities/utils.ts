// Random utilities that don't belong anywhere else

interface toColumnsOpts {
	padChar: string,
	justify: boolean
}

/* Create column-aligned text array from object with string key/values */
export function toColumns(obj: { [key: string]: string }, opts = {} as toColumnsOpts): string[] {
	_.defaults(opts, {
		padChar: ' ',	// Character to pad with, e.g. "." would be key........val
		justify: false 	// Right align values column?
	});

	let ret = [];
	let keyPadding = _.max(_.map(_.keys(obj), str => str.length)) + 1;
	let valPadding = _.max(_.mapValues(obj, str => str.length));

	for (let key in obj) {
		if (opts.justify) {
			ret.push(key.padRight(keyPadding, opts.padChar) + obj[key].padLeft(valPadding, opts.padChar));
		} else {
			ret.push(key.padRight(keyPadding, opts.padChar) + obj[key]);
		}
	}

	return ret;
}

/* Merges a list of store-like objects, summing overlapping keys. Useful for calculating assets from multiple sources */
export function mergeSum(objects: { [key: string]: number | undefined }[]): { [key: string]: number } {
	let ret: { [key: string]: number } = {};
	for (let object of objects) {
		for (let key in object) {
			let amount = object[key] || 0;
			if (!ret[key]) {
				ret[key] = 0;
			}
			ret[key] += amount;
		}
	}
	return ret;
}
