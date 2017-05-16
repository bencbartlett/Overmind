![](/assets/OvermindLogo.png)

# Overmind Screeps AI

Screeps is an [MMO strategy game for programmers](https://screeps.com/). The core objective is to expand your colony; to control your units, you write code in JavaScript (or any other transpiled language of your choice). The units run in real-time even when you aren't actively playing the game, so making a reliable AI to control them is important.

This is the AI system I have been developing for Screeps. It is a centrally-managed AI with a structure based loosely on the [Zerg's swarm intelligence](http://starcraft.wikia.com/wiki/Overlord) from Starcraft. Creep activities in each colony are prioritized and managed by a central `Overlord` object, which handles task assignment, reacts to stimuli with `objectives` and `directives`, and manages spawner activity through the `hatchery` object.

### Contributing to Overmind
I'm not accepting contributions to Overmind until the main framework is finished (probably about another 3 weeks of coding at my current rate). After Overmind is "complete", I'll begin accepting pull requests. 

### Using Overmind as your AI
If you're new to screeps, I wouldn't recommend using Overmind; most of the fun of the game is programming your own AI and watching your code run like a well-oiled machine! (Or, more frequently, go down in flames like an overly-oiled machine...) However, when I first started playing screeps, I was frustrated by scantily-documented codebases, so Overmind was programmed with readability and documentation in mind, so it might be a good resource to reference when coding your first AI!

If you do want to use Overmind as-is, it "should" work right out of the box, although the codebase is under a lot of development right now, so I might have broken something. If it seems I have, please [submit an issue](https://github.com/bencbartlett/Overmind/issues/new) and I'll try to fix it.

### TypeScript
Overmind is coded in TypeScript 2.2, which automatically catches a lot of would-be runtime errors and allows for a much nicer, more object-oriented coding style.

### Find me in game! (username: Muon)
I'm currently around the [`W1XN8X` sector](https://screeps.com/a/#!/map?pos=-19.173,-88.435). If my AI is being too agressive, feel free to message me about it. I'm working on developing a whitelist to make Overmind stop attacking players who opt out of it.

# AI Structure

[Updated version coming soon.]

![AI structural schematic](/assets/AIdiagram.png)



# Design overview

[Updated version coming soon.]

## Brains

Most of the logic in the AI is processed in `Brain` objects, which act as a centralized handler for things that are too complex to put into `prototypes_*` files. A brain for each applicable object is instantiated at the beginning of each tick, stored in a `Overmind.*Brains` object, and is bound to the object with a prototype `*.brain` property. For example, creeps are controlled primarily by the `RoomBrain` of their `workRoom`, which also handles spawner operations and requests from remotely assigned flags.

## Creep roles
Every creep has a behavior pattern called a role, stored as a string reference in `creep.memory.role`. Most creep roles have very similar code structure; they are all extensions of the base `Role` class, but different roles have different applicable tasks that can be assigned to them by the room brain. However, some roles, particularly simple roles like linkers and scouts, don't communicate much with the room brain past spawning, while others, like workers, are controlled completely by the room brain.

## Tasks
Almost all state-changing actions performed by a creep are done by a `Task`, which encapsulates information describing what action to do, what target to do the action to, how to get to the target, under what conditions the action can be performed, how many creeps can target a given object, and other instructions. Tasks all extend the base `Task` class, overwriting the validity checks and the `work` messsage for each child task. Tasks exist as an object of strings in creep memory, which is reconstructed each time the task object is referenced; serializable portions of tasks are saved at each tick in memory.

## Flags
Flags are used as the interaction point between manual user input and the autonomous AI. Flags have a category and type associated with their `color` and `secondaryColor` attributes. Each flag type has an associated `filter` (to determine if the flag matches the type) and `action` property, which is an injectable code-snippet that can be processed by the assigned `brain` object. For example, the `millitary.guard` flag type instructs the room brain assigned to it using `flag.assign(roomName)` to spawn a guard when hostile creeps enter a mining outpost. A (possibly outdated) list of flag actions is given below; check `map_flag_codes.js` for more up-to-date information.

### Flag codes:
- Millitary (red/*): actions involving the spawning and direction of offensive or defensive creeps
    - Destroyer (red/red): spawns an attack creep to destroy everything in the targeted room
    - Guard (red/blue): spawns a guard if an invasion is happening in the flagged room
    - Sieger (red/yellow): spawns a dismantler creeps that specializes in taking down walls
- Destroy (orange/*): directs creeps to prioritize certain objects; flags are removed when object is destroyed
    - Attack (orange/red): attack this object first
    - Dismantle (orange/yellow): dismantle this object first
- Industry (yellow/*): actions related to remote gathering of resources
    - RemoteMine (yellow/yellow): spawns miners and haulers to container-mine from a remote source
- Minerals (cyan/*): directs labs to contain certain minerals, stored as strings in the flag memory
- Territory (purple/*): actions related to claiming or reserving a room
    - Reserve (purple/purple): reserve a neutral room and spawn workers if needed to build/repair objects in the room
    - ClaimAndIncubate (purple/white): claims a neutral room and marks it for incubation, which sends high-level workers and miners from the assigned room to quickly get the new room set up. High-level creeps are kept alive by using the `spawn.renewCreep()` method of the spawner in the incubating room.
- Vision (grey/*): actions related to gathering vision and information
    - Stationary (grey/grey): spawns a scout that goes to the flag and stays there. Basically only used for maintaining vision in a room.
- Rally (white/*): directs creeps to these flags under various conditions
    - IdlePoint (white/white): directs idle suppliers to gather here when there is nothing to do
    - HealPoint (white/green): directs millitary creeps to move here to receive healing

# Upcoming features
Overmind is still very much in active development, and some features haven't been fully implemented yet. This is a list of the features I'm planning on adding next, in approximate decreasing order of importance:
- Decentralized spawner scheduling algorithm based on a global creep production queue
- Automatic expansion planning
- Automatic base building
- Automatic invasion planning
