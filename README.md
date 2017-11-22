![](/assets/OvermindLogo.png)

# Overmind Screeps AI

Screeps is an [MMO strategy game for programmers](https://screeps.com/). The core objective is to expand your colony; to control your units, you write code in JavaScript (or any other transpiled language of your choice). The units run in real-time even when you aren't actively playing the game, so making a reliable AI to control them is important.

This is the AI system I have been developing for Screeps. It is a centrally-managed AI with a structure based loosely on the [Zerg's swarm intelligence](http://starcraft.wikia.com/wiki/Overlord) from Starcraft. Creep activities in each colony are prioritized and managed by a central `Overlord` object, which handles task assignment, reacts to stimuli with `objectives` and `directives`, and manages spawner activity through the `hatchery` object.

### Using Overmind as your AI
If you're new to screeps, I wouldn't recommend using Overmind; most of the fun of the game is programming your own AI and watching your code run like a well-oiled machine! (Or, more frequently, go down in flames like an overly-oiled machine...) However, when I first started playing screeps, I was frustrated by scantily-documented codebases, so Overmind was programmed with readability and documentation in mind, so it might be a good resource to reference when coding your first AI!

If you do want to use Overmind as-is, it "should" work right out of the box, although the codebase is under a lot of development right now, so I might have broken something. If it seems I have, please [submit an issue](https://github.com/bencbartlett/Overmind/issues/new) and I'll try to fix it.

### TypeScript
Overmind is coded in TypeScript 2.2, which automatically catches a lot of would-be runtime errors and allows for a much nicer, more object-oriented coding style.

### Find me in game! (username: Muon)
I'm currently around the [`W1XN8X` sector](https://screeps.com/a/#!/map?pos=-19.173,-88.435). If my AI is being too agressive, feel free to message me about it. I'm working on developing a whitelist to make Overmind stop attacking players who opt out of it.

# AI Structure

![AI structural schematic](/assets/AIdiagram.png)



# Design overview

Check out the [Overmind wiki](https://github.com/bencbartlett/Overmind/wiki) for in-depth explanations of parts of the design of the AI.

* [Hive clusters](https://github.com/bencbartlett/Overmind/wiki/Design:-Hive-Clusters)

