import {profile} from '../profiler/decorator';

const MAX_ACTIVE_SEGMENTS = 10;

interface SegmenterMemory {
	activeSegments: number[];
	activeForeignSegment: {
		username: string,
		id?: number,
	} | undefined;
	publicSegments: number[];
}

interface SegmenterCache {
	segments: { [id: number]: { [prop: string]: any }; };
	lastAccessed: { [id: number]: number | undefined };
	lastModified: { [id: number]: number | undefined };
}

const DefaultSegmenterMemory: SegmenterMemory = {
	activeSegments      : [],
	activeForeignSegment: undefined,
	publicSegments      : [],
};

if (!Memory.segmenter) {
	Memory.segmenter = {};
}
_.defaultsDeep(Memory.segmenter, DefaultSegmenterMemory);

/**
 * The segmenter module controls public and private segment memory access
 */
@profile
export class Segmenter {

	private static cache: SegmenterCache = {
		segments    : {},
		lastAccessed: {},
		lastModified: {},
	};

	static get memory(): SegmenterMemory {
		return Memory.segmenter;
	}

	static requestSegments(...ids: number[]) {
		for (const id of ids) {
			if (!this.memory.activeSegments.includes(id)) {
				this.memory.activeSegments.push(id);
				if (this.memory.activeSegments.length > MAX_ACTIVE_SEGMENTS) {
					const removeSegment = this.memory.activeSegments.shift();
					console.log(`Maximum active segments reached. Discarding segment ${removeSegment}.`);
				}
			}
		}
	}

	static getSegment(id: number): { [prop: string]: any } {
		if ((this.cache.lastAccessed[id] || 0) > (this.cache.lastModified[id] || 0)) {
			return this.cache.segments[id];
		}

		const str = RawMemory.segments[id];
		let segment: { [prop: string]: any };
		try {
			segment = JSON.parse(str);
		} catch (e) {
			console.log(`Creating new object for RawMemory.segments[${id}].`);
			segment = {};
			this.cache.segments[id] = segment;
			this.cache.lastModified[id] = Game.time;
		}

		this.cache.segments[id] = segment;
		this.cache.lastAccessed[id] = Game.time;

		return this.cache.segments[id];
	}

	static getSegmentProperty(id: number, key: string): any | undefined {
		const segment = this.getSegment(id);
		return segment[key];
	}

	static setSegment(id: number, value: { [prop: string]: any }): void {
		this.cache.segments[id] = value;
		this.cache.lastModified[id] = Game.time;
	}

	static setSegmentProperty(id: number, key: string, value: any): void {
		const segment = this.getSegment(id);
		segment[key] = value;
		this.cache.lastModified[id] = Game.time;
	}

	static requestForeignSegment(username: string | null, id?: number): void {
		if (username) {
			this.memory.activeForeignSegment = {
				username: username,
				id      : id,
			};
		}
	}

	static markSegmentAsPublic(id: number): void {
		if (!this.memory.publicSegments.includes(id)) {
			this.memory.publicSegments.push(id);
		}
	}

	static getForeignSegment(): { [prop: string]: any } | undefined {
		if (RawMemory.foreignSegment) {
			let segment: { [prop: string]: any };
			try {
				segment = JSON.parse(RawMemory.foreignSegment.data);
				return segment;
			} catch (e) {
				console.log(`Could not parse RawMemory.foreignSegment.data!`);
			}
		}
	}

	static getForeignSegmentProperty(key: string): any | undefined {
		if (RawMemory.foreignSegment) {
			let segment: { [prop: string]: any };
			try {
				segment = JSON.parse(RawMemory.foreignSegment.data);
			} catch (e) {
				segment = {};
				console.log(`Could not parse RawMemory.foreignSegment.data!`);
			}
			return segment[key];
		}
	}

	static run() {
		// Set active, public, and foreign segments
		RawMemory.setActiveSegments(this.memory.activeSegments);
		RawMemory.setPublicSegments(this.memory.publicSegments);
		if (this.memory.activeForeignSegment) {
			RawMemory.setActiveForeignSegment(this.memory.activeForeignSegment.username,
											  this.memory.activeForeignSegment.id);
		} else {
			RawMemory.setActiveForeignSegment(null);
		}
		// Write things that have been modified this tick to memory
		for (const id in this.cache.lastModified) {
			if (this.cache.lastModified[id] == Game.time) {
				RawMemory.segments[id] = JSON.stringify(this.cache.segments[id]);
			}
		}
	}

}
