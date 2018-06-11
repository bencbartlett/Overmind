// Default ordering for processing spawning requests and prioritizing overlords

export var OverlordPriority = {
	emergency: {				// Colony-wide emergencies such as a catastrohic crash
		bootstrap: 0
	},

	spawning: {					// Functionality related to spawning more creeps
		hatchery     : 100,
		commandCenter: 101,
	},

	defense: {					// Defense of local and remote rooms
		meleeDefense : 200,
		rangedDefense: 201,
		guard        : 202,
	},

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
	},

	upgrading: {				// Spawning upgraders
		upgrade: 600,
	},

	collectionUrgent: { 		// Collecting resources that are time sensitive, like decaying resources on ground
		haul: 700
	},

	remoteRoom: { 				// Operation of a remote room. Allows colonies to restart one room at a time.
		reserve      : 800,
		mine         : 801,
		roomIncrement: 5, 			// remote room priorities are incremented by this for each outpost
	},

	collection: {				// Non-urgent collection of resources, like from a deserted storage
		haul: 900
	},
};