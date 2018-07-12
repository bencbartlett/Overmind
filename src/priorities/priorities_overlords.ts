// Default ordering for processing spawning requests and prioritizing overlords

export var OverlordPriority = {
	emergency: {				// Colony-wide emergencies such as a catastrohic crash
		bootstrap: 0
	},

	core: {						// Functionality related to spawning more creeps
		queen  : 100,
		manager: 101,

		//controllerAttack: 199   // Reserved to give controller attacks a high priority
	},

	defense: {					// Defense of local and remote rooms
		meleeDefense : 200,
		rangedDefense: 201,
		guard        : 202,
		repair       : 203,
	},

	warSpawnCutoff: 299, 		// Everything past this is non-critical and won't be spawned in case of emergency

	realTime: { 				// Requests that a user is typically actively waiting for in real life
		claim  : 300,
		pioneer: 301,
	},

	ownedRoom: { 				// Operation of an owned room
		firstTransport: 400,		// High priority to spawn the first transporter
		mine          : 401,
		work          : 402,
		mineral       : 403,
		transport     : 404,		// Spawn the rest of the transporters
	},

	offense: {					// Offensive operations like raids or sieges
		destroy  : 500,
		healPoint: 501,
		siege    : 502,
		controllerAttack: 199,  // Reserved above to have a high priority
	},

	upgrading: {				// Spawning upgraders
		upgrade: 600,
	},

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

	collection: {				// Non-urgent collection of resources, like from a deserted storage
		haul: 1000
	},

	default: 999999				// Default overlord priority to ensure it gets run last
};