// Alliance / IFF detection, ported from screeps-scripts/src/alliance.ts.
// Observation-only for now — wired through sandbox.ts, not yet consulted by
// tower/combat targeting. See obsidian ADR 0006 for the staged rollout plan.

export const ALLIANCE = {
	// In-game usernames of allied players. Towers, defenders, and combat
	// logic MUST filter targets against this list before attacking, once
	// this module is wired into targeting (not yet done).
	allies: [
		'stoleas',    // our MMO username
		'zh0ul',      // zh0ul's MMO username
	],

	// Secret keyword for controller-sign-based friend discovery.
	// Both players sign their controllers with this string. When you scout
	// a room, you read controller.sign.text — if it matches, the signer's
	// username (controller.sign.username) is a friend.
	// This lets scripts discover allies dynamically without editing this file.
	// Both players must agree on the keyword and keep it secret.
	signKeyword: 'ZERG_ALLIANCE',

	// Flag prefix for in-game ally discovery.
	// Place flags named "ally:<username>@<roomName>" in any room to mark
	// that username as an ally. The @<roomName> suffix is required because
	// Screeps flag names are globally unique — you can't place "ally:zh0ul"
	// in two different rooms. Use "ally:zh0ul@W1N1", "ally:zh0ul@W2N3", etc.
	// Both players import this file. Flags are owner-visible only.
	// Legacy format "ally:<username>" (without @roomName) is still accepted.
	flagPrefix: 'ally:',

	// Update cadence — how often to refresh ally data (in ticks).
	commsRefreshInterval: 10,
};

// --- Ally detection -------------------------------------------------
// Three mechanisms: static list, controller signs, and in-game flags.

// Check if a username is an ally via the static allies list.
export function isAlly(username: string): boolean {
	return ALLIANCE.allies.includes(username);
}

// Check if a room's controller sign matches the alliance keyword.
// If it does, the signer's username is an ally. This lets you discover
// new allies dynamically — they just sign their controller with the
// secret keyword and you'll recognize them without editing code.
export function isAllyBySign(room: Room): string | null {
	if (!room.controller) return null;
	const sign = room.controller.sign;
	if (!sign) return null;
	if (sign.text === ALLIANCE.signKeyword) {
		return sign.username;
	}
	return null;
}

// Scan Game.flags for names like "ally:zh0ul@W1N1" and return the set of
// ally usernames discovered. Flags are owner-visible only — each player
// places their own flags in-game to manage their friend list.
// Cached per tick; logs when the discovered set changes.
let flagAlliesCache: { tick: number, allies: Set<string> } = {tick: -1, allies: new Set()};

export function getFlagAllies(): Set<string> {
	if (flagAlliesCache.tick === Game.time) {
		return flagAlliesCache.allies;
	}
	const allies = new Set<string>();
	const prefix = ALLIANCE.flagPrefix;
	for (const flagName in Game.flags) {
		if (flagName.startsWith(prefix)) {
			// Format: "ally:<username>@<roomName>" or legacy "ally:<username>"
			const suffix = flagName.slice(prefix.length);
			let username: string;
			const atIndex = suffix.indexOf('@');
			if (atIndex !== -1) {
				username = suffix.slice(0, atIndex);
			} else {
				username = suffix;
			}
			if (username) allies.add(username);
		}
	}

	const prev = flagAlliesCache.allies;
	const prevArr = Array.from(prev).sort();
	const currArr = Array.from(allies).sort();
	if (prevArr.join(',') !== currArr.join(',')) {
		if (allies.size > 0) {
			console.log(`[Alliance] Flag allies: ${currArr.join(', ')}`);
		} else if (prev.size > 0) {
			console.log('[Alliance] Flag allies cleared (no ally: flags found)');
		}
	}

	flagAlliesCache = {tick: Game.time, allies};
	return allies;
}

// Check if a username is an ally via in-game flags.
export function isAllyByFlag(username: string): boolean {
	return getFlagAllies().has(username);
}

// Combined check: is a username an ally via any mechanism?
// - Static allies list
// - Controller sign (if visibleRooms provided)
// - In-game flags (ally:<username>@<roomName>)
export function isFriend(username: string, visibleRooms?: Room[]): boolean {
	if (isAlly(username)) return true;
	if (isAllyByFlag(username)) return true;
	if (visibleRooms) {
		for (const room of visibleRooms) {
			const signedBy = isAllyBySign(room);
			if (signedBy === username) return true;
		}
	}
	return false;
}

// --- Auto-flag placement ---------------------------------------------
// Automatically create ally:<username>@<roomName> flags so the user doesn't
// have to type room names manually. Two cases:
//   1. In owned rooms: flag every ally from the static list.
//   2. In visible rooms where an ally has creeps/structures: flag that ally.
// Throttled to avoid CPU waste — flags persist, so periodic checks suffice.

const AUTOFLAG_INTERVAL = 100; // every ~5 minutes

export function autoFlagAllies(colonies: Room[], visibleRooms: Room[]): void {
	if (Game.time % AUTOFLAG_INTERVAL !== 0) return;

	const prefix = ALLIANCE.flagPrefix;

	const existing = new Set<string>();
	for (const flagName in Game.flags) {
		if (flagName.startsWith(prefix)) {
			existing.add(flagName);
		}
	}

	const roomsToCheck = new Set<Room>();

	// Case 1: Owned rooms — flag every static-list ally.
	for (const room of colonies) {
		roomsToCheck.add(room);
	}

	// Case 2: Visible rooms where an ally has creeps or structures.
	for (const room of visibleRooms) {
		if (room.controller && room.controller.my) continue; // already in colonies
		const hasAllyPresence = room.find(FIND_HOSTILE_CREEPS).some(c =>
			ALLIANCE.allies.includes(c.owner.username)
		) || room.find(FIND_HOSTILE_STRUCTURES).some(s =>
			s.owner && ALLIANCE.allies.includes(s.owner.username)
		);
		if (hasAllyPresence) {
			roomsToCheck.add(room);
		}
	}

	for (const room of roomsToCheck) {
		const isOwned = room.controller && room.controller.my;
		const alliesToFlag = isOwned ? ALLIANCE.allies :
			room.find(FIND_HOSTILE_CREEPS)
				.map(c => c.owner.username)
				.concat(room.find(FIND_HOSTILE_STRUCTURES)
					.map(s => s.owner ? s.owner.username : '')
					.filter(u => ALLIANCE.allies.includes(u)));

		const uniqueAllies = Array.from(new Set(alliesToFlag));

		for (const username of uniqueAllies) {
			const flagName = `${prefix}${username}@${room.name}`;
			if (existing.has(flagName)) continue;

			const pos = room.controller ? room.controller.pos : new RoomPosition(25, 25, room.name);
			const result = pos.createFlag(flagName, COLOR_WHITE, COLOR_BLUE);
			// createFlag returns the flag name (string) on success, or an
			// error code (number) on failure. ERR_NAME_EXISTS (-3) means
			// the flag already exists — that's fine, skip silently.
			if (typeof result === 'string') {
				console.log(`[Alliance] Auto-placed flag ${flagName}`);
				existing.add(flagName);
			}
		}
	}
}
