// Default ordering for processing spawning requests and prioritizing overlords

export var OverlordPriority = {
	emergency : {			// Colony-wide emergencies such as a catastrohic crash
		bootstrap: 0
	},
	spawning  : {			// Functionality related to spawning more creeps
		hatchery     : 100,
		commandCenter: 101,
	},
	defense   : {			// Defense of local and remote rooms
		guard: 200,
	},
	realTime  : { 			// Requests that a user is typically actively waiting for
		claim  : 300,
		pioneer: 301,
	},
	ownedRoom : { 			// Operation of an owned room
		supply : 400,
		mine   : 401,
		work   : 402,
		haul   : 403,
		upgrade: 404,
	},
	remoteRoom: { 			// Operation of a remote room. Allows colonies to restart one room at a time.
		reserve      : 500,
		mine         : 501,
		// haul         : 502, // hauling is a weird exception; see miningGroup for details
		roomIncrement: 10, 	// remote room priorities are incremented by 10 for each outpost
	},
};