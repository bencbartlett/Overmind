![](/assets/OvermindLogo.png)

# Overmind Screeps AI

Screeps is an [MMO strategy game for programmers](https://screeps.com/). The core objective is to expand your colony; to control your units, you write code in JavaScript (or a transpiled language). The units run in real-time even when you aren't actively playing the game.

This is the AI system I have been developing for Screeps, themed loosely on the [Zerg's swarm intelligence](http://starcraft.wikia.com/wiki/Overlord) from Starcraft: creep activities in each colony are prioritized and managed by a central `Overlord` object, which handles task assignment, reacts to stimuli with `objectives` and `directives`, and manages spawner activity through the `hatchery` object.

Overmind is unaffiliated with the thematically-similar and more recent Overlords alliance.

### We're on slack!
Found something you like, hate, or find confusing? Join the discussion on Slack in the [#overmind](https://screeps.slack.com/messages/overmind) channel!

### Another rewrite
I've added a lot of changes recently and they don't all play well with each other. I have a lot of ideas and finally a large chunk of free time, so over the next few weeks I'll be doing a third rewrite of the AI which I plan to result in version 1.0. Stay tuned for more!

### Using Overmind as your AI
If you're new to screeps, I wouldn't recommend using Overmind; most of the fun of the game is programming your own AI and watching your code run like a well-oiled machine! However, when I first started playing Screeps and was looking for inspiration in other codebases, I was frustrated by a general lack of documentation and readibility, so Overmind was programmed with this in mind; it might be a good resource to reference when coding your first AI!

If you do want to use Overmind as-is, it "should" work right out of the box, although the codebase is under a lot of development right now, so I might have broken something. If it seems I have, please [submit an issue](https://github.com/bencbartlett/Overmind/issues/new) and I'll try to fix it.

### Installation 
Setting up the code base is simple with `npm`. To install, navigate to the Overmind root directory and run

```npm install```

To compile (to a single `main.js` file) and deploy to the Screeps server, create a `credentials.json` file from the example in the `/config` directory, then nagivate to the Overmind root and run


```npm run deploy```


### Find me in game! (username: Muon)
I'm currently around the [`W1XN8X` sector](https://screeps.com/a/#!/map?pos=-19.173,-88.435), but I plan on respawning to a faster shard sometime in the near future!

# AI Structure

![AI structural schematic](/assets/AIdiagram.png)



# Design overview

Check out the [Overmind wiki](https://github.com/bencbartlett/Overmind/wiki) for in-depth explanations of parts of the design of the AI.

* [Hive clusters](https://github.com/bencbartlett/Overmind/wiki/Design:-Hive-Clusters)

