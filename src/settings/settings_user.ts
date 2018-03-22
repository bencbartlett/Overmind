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

// A personal note on this:

// I had some bad experiences with people running very developed screeps AI's in newbie zones back when I first started
// playing, and I think it's one of the worst aspects of the game, since it removes a lot of motivation for new players
// to write their own code. There are about a half-dozen people running Overmind on the public servers currently, and
// some of them have changed the controller signatures to hide the fact that they're running a bot or to represent
// it as their own work. Aside from the fact that I worked really hard writing this AI and seeing it misrepresented
// feelsbadman.jpg, this is unfair to neighboring new players, since they are facing a mature AI and don't even
// have the advantage of being able to view the source code for it. This prompted me to add a licese to my repository
// to prevent parts of the AI from being modified. Currently, this covers not modifying the controller signature, but
// will eventually include features limiting aggression toward new players on public servers and preferably targeting
// other bots.

let overmindSignature = 'Overmind Screeps AI'; // <DO-NOT-MODIFY> see license for details

let suffix = ''; // Put your signature suffix here; will be signed as "Overmind Screeps AI: <suffix>"

export var signature = overmindSignature + (suffix ? ': ' + suffix : ''); // <DO-NOT-MODIFY> see license for details

