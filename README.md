<img src="/assets/img/OvermindLogo.png" width=825>

[<img src="/assets/img/buttons/download.png" height=22>](https://github.com/bencbartlett/Overmind/releases)   [<img src="/assets/img/buttons/patchNotes.png" height=22>](https://github.com/bencbartlett/Overmind/blob/master/CHANGELOG.md)   [<img src="/assets/img/buttons/documentation.png" height=22>](https://bencbartlett.github.io/overmind-docs/)   [<img src="/assets/img/buttons/wikipages.png" height=22>](https://github.com/bencbartlett/Overmind/wiki)   [<img src="/assets/img/buttons/slack.png" height=22>](https://screeps.slack.com/messages/overmind)   [<img src="/assets/img/buttons/issue.png" height=22>](https://github.com/bencbartlett/Overmind/issues/new)   [<img src="/assets/img/buttons/featureRequest.png" height=22>](https://github.com/bencbartlett/Overmind/issues/new?template=feature_request.md)

### Current release: [Overmind v0.5.2 - Evolution](https://github.com/bencbartlett/Overmind/releases)   [![Build Status](https://travis-ci.org/bencbartlett/Overmind.svg?branch=master)](https://travis-ci.org/bencbartlett/Overmind)

- See the [changelog](https://github.com/bencbartlett/Overmind/blob/master/CHANGELOG.md) for patch notes
- Documentation is available at the [documentation site](https://bencbartlett.github.io/overmind-docs/) and the [wiki](https://github.com/bencbartlett/Overmind/wiki)
- Join the discussion in the [#overmind](https://screeps.slack.com/messages/overmind) Slack channel!
- Read [blog posts](https://bencbartlett.wordpress.com/category/screeps/) about development
- Submit an issue [here](https://github.com/bencbartlett/Overmind/issues/new) or request a feature [here](https://github.com/bencbartlett/Overmind/issues/new?template=feature_request.md)
- Find me in game [here](https://screeps.com/a/#!/profile/Muon)

---

# About Overmind

<img align="right" src="/assets/img/exampleRoomBanner2.png" width=325>

### What is Screeps?

Screeps is an [MMO strategy game for programmers](https://screeps.com/). The core objective is to expand your colony, gathering resources and fighting other players along the way. To control your units, you code an AI in JavaScript; everything from moving, mining, building, fighting, and trading is entirely driven by your code. Because Screeps is an MMO, it takes place on a single server that runs 24/7, populated by every other player and their army of creeps. When you log off, your population continues buzzing away with whatever task you set them. Screeps pits your programming prowess head-to-head with other people to see who can think of the most efficient methods of completing tasks or imagine new ways to defeat enemies.

### What is Overmind?

Overmind is my personal codebase that I run on the public server. The structure of the AI is themed loosely around the [Zerg's swarm intelligence](http://starcraft.wikia.com/wiki/Overlord) from Starcraft. [Overlords](https://github.com/bencbartlett/Overmind/blob/master/src/overlords/Overlord.ts) orchestrate Creep actions within each [Colony](https://github.com/bencbartlett/Overmind/blob/master/src/Colony.ts), and the colony [Overseer](https://github.com/bencbartlett/Overmind/blob/master/src/Overseer.ts) places [Directives](https://github.com/bencbartlett/Overmind/blob/master/src/directives/Directive.ts) to adapt to stimuli. Finally, the [Assimilator](https://github.com/bencbartlett/Overmind/blob/master/src/assimilation/Assimilator_obfuscated.js) allows all players running Overmind to act as a collective hivemind, sharing creeps and resources and responding jointly to a master ledger of all directives shared by all players.

The AI is entirely automated, although it can also run in manual or semiautomatic mode. The [latest release](https://github.com/bencbartlett/Overmind/releases) should work right out of the box; however, if you find something broken, please [submit an issue](https://github.com/bencbartlett/Overmind/issues/new) and I'll try to fix it.

### Can I use Overmind as my bot?
If you're new to Screeps, I would definitely recommend writing your own AI: most of the fun of the game is programming your own bot and watching your little ant farm run! However, I've tried to make the codebase readable and well-documented, so feel free to fork the project or use it as inspiration when writing your AI.

If you still want to use Overmind on the public server, that's okay too - [there are a number of people already doing this](http://www.leagueofautomatednations.com/map/shard2/bots). But please realize that using a mature AI like this gives you a huge advantage over other new players, so don't go out of your way to ruin someone else's fun. In the future, I will be implementing methods for novice players to opt out of excessive aggression by Overmind bots (as long as they don't start a conflict and stay out of its way).

# Installation

### Out of the box
If you just want to run Overmind without modification, you can copy the compiled `main.js` file attached to the [latest release](https://github.com/bencbartlett/Overmind/releases) into your script. While Overmind is fully automated by default, it can be run with varying levels of autonomy; refer to the [Overmind wiki](https://github.com/bencbartlett/Overmind/wiki) for how to configure and operate the bot.

### Compiling from source
To install the full codebase, download or clone the repository. (Please note that while the latest release of Overmind should always be stable, the latest commit may contain unstable features.) Navigate to the Overmind root directory and run ```npm install```. To compile and deploy the codebase, create a `screeps.json` file from the [example file](https://github.com/bencbartlett/Overmind/blob/master/screeps.example.json), then do one of the following actions:

- Compile and deploy to public server: `npm run push-main`
- Compile and deploy to private server: `npm run push-pserver`
- Compile without deploying: `npm run compile`

Overmind uses `rollup` to bundle the compiled TypeScript into a single `main.js` file. The codebase includes functionality to compute checksums for internal validation - if you have a different version of `rollup` installed globally, different checksums may be computed and some functionality will be disabled. Please ensure the local installation of `rollup` found in `node_modules` is used.

### Setting up the Grafana dashboard

Overmind includes a [Grafana dashboard](https://github.com/bencbartlett/Overmind/tree/master/assets/Grafana%20Dashboards) (shown below) which tracks detailed operating statistics. To set up the dashboard:

1. Register for grafana service at [screepspl.us](https://screepspl.us/services/grafana)
2. Setup the [ScreepsPlus hosted agent](https://screepspl.us/services/hosted-agent/) (simpler) or use the NodeJS agent [on a free micro instance of Google Compute](https://github.com/bonzaiferroni/bonzAI/wiki/Screepspl.us-agent-with-Compute-Engine).
3. Import the dashboard from [Overmind.json](https://github.com/bencbartlett/Overmind/blob/master/assets/Grafana%20Dashboards/Overmind.json) and change `$User` to your username.
4. Enjoy your pretty graphs!

![](/assets/img/dashboard_compacted_2.png)

# Design overview

Check out the [Overmind wiki](https://github.com/bencbartlett/Overmind/wiki) for in-depth explanations of parts of the design of the AI. (Click the diagram below to see a higher-resolution version.)

![[AI structural schematic](/assets/AIdiagram.png)](https://raw.githubusercontent.com/bencbartlett/Overmind/master/assets/img/AIdiagram.png)

