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


// Configuring controller signature ====================================================================================

let overmindSignature = 'Overmind Screeps AI'; // <DO-NOT-MODIFY> see license for details

let suffix = ''; // Put your signature suffix here; will be signed as "Overmind Screeps AI: <suffix>"

export var signature = overmindSignature + (suffix ? ': ' + suffix : ''); // <DO-NOT-MODIFY> see license for details

