![](/assets/OvermindLogo.png)

# Overmind Screeps AI

Screeps is an [MMO strategy game for programmers](https://screeps.com/). The core objective is to expand your colony; to control your units, you write code in JavaScript (or a transpiled language). The units run in real-time even when you aren't actively playing the game.

This is the AI system I have been developing for Screeps, themed loosely on the [Zerg's swarm intelligence](http://starcraft.wikia.com/wiki/Overlord) from Starcraft. Creeps belong to [Colonies](https://github.com/bencbartlett/Overmind/blob/master/src/Colony.ts), which have several [Hive Clusters](https://github.com/bencbartlett/Overmind/blob/master/src/hiveClusters/HiveCluster.ts). Creep actions for a given process are orchestrated by [Overlords](https://github.com/bencbartlett/Overmind/blob/master/src/overlords/Overlord.ts). The colony [Overseer](https://github.com/bencbartlett/Overmind/blob/master/src/Overseer.ts) places [Directives](https://github.com/bencbartlett/Overmind/blob/master/src/directives/Directive.ts) to adapt to stimuli.


### We're on slack!
Found something you like, hate, or find confusing? Join the discussion on Slack in the [#overmind](https://screeps.slack.com/messages/overmind) channel!


### Using Overmind as your AI
If you're new to screeps, I wouldn't recommend using Overmind out of the box; most of the fun of the game is programming your own AI and watching your code run like a well-oiled machine! However, when I first started playing Screeps and was looking for inspiration in other codebases, I was frustrated by a general lack of documentation and readibility, so Overmind was programmed with this in mind; it might be a good resource to reference when coding your first AI!

If you do want to use Overmind as-is, it "should" work right out of the box. However, if you find something broken, please [submit an issue](https://github.com/bencbartlett/Overmind/issues/new) and I'll try to fix it.

### Installation 
Overmind uses the [`screeps-typescript-starter v3.0`](https://github.com/screepers/screeps-typescript-starter) installation and deployment scripts. Setting up the code base is simple with `npm`. To install, navigate to the Overmind root directory and run

```npm install```

To compile (to a single `main.js` file) and deploy to the Screeps server, create a `screeps.json` file from the example, then nagivate to the Overmind root and run

```npm run push-main```

For additional help, see the [`screeps-typescript-starter` GitBook](https://screepers.gitbooks.io/screeps-typescript-starter/getting-started/deploying.html).

### Find me in game! (username: Muon)
I've recently respawned to shard2 in the [`EXS4X` sector](https://screeps.com/a/#!/map/shard2?pos=5.826,44.939).


# AI Structure

![AI structural schematic](/assets/AIdiagram.png)


# Design overview

Check out the [Overmind wiki](https://github.com/bencbartlett/Overmind/wiki) for in-depth explanations of parts of the design of the AI.

* [Hive clusters](https://github.com/bencbartlett/Overmind/wiki/Design:-Hive-Clusters)

