![](/assets/OvermindLogo.png)

# Overmind Screeps AI

Current release: [Overmind v0.2.x - "Logistics Logic"](https://github.com/bencbartlett/Overmind/releases)

---

## What is Screeps?
Screeps is an [MMO strategy game for programmers](https://screeps.com/). The core objective is to expand your colony to gather more resources. The game runs 24/7, even when you aren't actively playing; to control your units, you program their behavior in JavaScript or any other transpiled language. This is the AI I have been developing for Screeps, themed loosely around the [Zerg's swarm intelligence](http://starcraft.wikia.com/wiki/Overlord) from Starcraft. Creeps belong to [Colonies](https://github.com/bencbartlett/Overmind/blob/master/src/Colony.ts), which have several [Hive Clusters](https://github.com/bencbartlett/Overmind/blob/master/src/hiveClusters/HiveCluster.ts). Creep actions for a given process are orchestrated by [Overlords](https://github.com/bencbartlett/Overmind/blob/master/src/overlords/Overlord.ts). The colony [Overseer](https://github.com/bencbartlett/Overmind/blob/master/src/Overseer.ts) places [Directives](https://github.com/bencbartlett/Overmind/blob/master/src/directives/Directive.ts) to adapt to stimuli.

### We're on slack!
Found something you like, hate, or find confusing? Join the discussion on Slack in the [#overmind](https://screeps.slack.com/messages/overmind) channel!

### Find me in game! (username: Muon)
I've recently respawned to shard2 in the [`EXS4X` sector](https://screeps.com/a/#!/map/shard2?pos=5.826,44.939).

## Using Overmind as your AI
If you're new to Screeps, I wouldn't recommend using Overmind as your AI: most of the fun of the game is programming your own AI and watching your little ant farm run! However, I've tried to make the codebase readable and well-documented, so feel free to fork the project or use it as inspiration when writing your AI. 

If you do want to use Overmind as-is, the [latest release](https://github.com/bencbartlett/Overmind/releases) should work right out of the box. However, if you find something broken, please [submit an issue](https://github.com/bencbartlett/Overmind/issues/new) and I'll try to fix it.

### Out of the box
If you just want to run Overmind without modification, you can copy the compiled `main.js` file attached to the [latest release](https://github.com/bencbartlett/Overmind/releases) into your script.

### Full installation 
If you want to install the full codebase, download or clone the repository, then navigate to the Overmind root directory and run:

```npm install```

(This will take about a minute to execute.) To compile and deploy the codebase, create a `screeps.json` file from the [example file](https://github.com/bencbartlett/Overmind/blob/master/screeps.example.json), then nagivate to the Overmind root directory and do one of the following actions:

- Compile and deploy to public server: `npm run push-main`
- Compile and deploy to private server: `npm run push-pserver`
- Compile without deploying: `rollup -c`

The deployment scripts are based on [`screeps-typescript-starter`](https://github.com/screepers/screeps-typescript-starter); for additional help, refer to their [GitBook](https://screepers.gitbooks.io/screeps-typescript-starter/getting-started/deploying.html) or [submit an issue](https://github.com/bencbartlett/Overmind/issues/new).

# Design overview

Check out the [Overmind wiki](https://github.com/bencbartlett/Overmind/wiki) for in-depth explanations of parts of the design of the AI. (Click the image below to see a higher-resolution version.)

![[AI structural schematic](/assets/AIdiagram.png)](https://raw.githubusercontent.com/bencbartlett/Overmind/master/assets/AIdiagram.png)

