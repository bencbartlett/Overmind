![](/img/OvermindLogo.png)

# Overmind Screeps AI

Screeps is an [MMO strategy game for programmers](https://screeps.com/). The core objective is to expand your colony; to control your units, you write code in JavaScript (or any other transpiled language of your choice). The units run in real-time even when you aren't actively playing the game, so making a reliable AI to control them is important.

This is the AI system I have been developing for Screeps. It is centrally-managed and task based. Creep activities in each room are managed by a central `RoomBrain` object, which handles task assignment and runs the spawners. Currently, the AI is mostly autonomous, requiring input only for structure construction and offense. 

Below is a general (but detailed) schematic of the design of my AI.

![AI structural schematic](/img/AIdiagram.png)



# Design

Coming soon!
