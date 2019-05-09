/**
 * Default ordering for processing spawning requests and prioritizing overlords
 */
export let OverlordPriority = {
	emergency: {				// Colony-wide emergencies such as a catastrohic crash
		bootstrap: 0
	},

	core: {						// Functionality related to spawning more creeps
		queen  : 100,
		manager: 101,
	},

	defense: {					// Defense of local and remote rooms
		meleeDefense : 200,
		rangedDefense: 201,
	},

	warSpawnCutoff: 299, 		// Everything past this is non-critical and won't be spawned in case of emergency

	offense: {					// Offensive operations like raids or sieges
		destroy         : 300,
		healPoint       : 301,
		siege           : 302,
		controllerAttack: 399
	},

	colonization: { 			// Colonizing new rooms
		claim  : 400,
		pioneer: 401,
	},

	ownedRoom: { 				// Operation of an owned room
		firstTransport: 500,		// High priority to spawn the first transporter
		mine          : 501,
		work          : 502,
		mineralRCL8   : 503,
		transport     : 510,		// Spawn the rest of the transporters
		mineral       : 520
	},

	outpostDefense: {
		outpostDefense: 550,
		guard         : 551,
	},

	upgrading: {				// Spawning upgraders
		upgrade: 600,
	},

	throttleThreshold: 699,  	// Everything past this may be throttled in the event of low CPU

	collectionUrgent: { 		// Collecting resources that are time sensitive, like decaying resources on ground
		haul: 700
	},

	scouting: {
		stationary  : 800,
		randomWalker: 801
	},

	remoteRoom: { 				// Operation of a remote room. Allows colonies to restart one room at a time.
		reserve      : 900,
		mine         : 901,
		roomIncrement: 5, 			// remote room priorities are incremented by this for each outpost
	},

	remoteSKRoom: {
		sourceReaper : 1000,
		mineral      : 1001,
		mine         : 1002,
		roomIncrement: 5,
	},

	collection: {				// Non-urgent collection of resources, like from a deserted storage
		haul: 1100
	},

	default: 99999				// Default overlord priority to ensure it gets run last
};
