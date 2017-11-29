// Global settings file containing player information

function getUsername(): string {
	for (let i in Game.rooms) {
		let room = Game.rooms[i];
		if (room.controller && room.controller.my) {
			return room.controller.owner.username;
		}
	}
	console.log('ERROR: Could not determine username. You can set this manually in src/settings/settings_user');
	return 'ERROR: Could not determine username.';
}

export var myUsername: string = getUsername(); // Your username

export var reserveCredits: number  = 10000; // Number of credits to reserve before buying market orders

export var controllerSignature: string = 'Overmind Screeps AI'; // Signature to place on owned and occupied rooms

