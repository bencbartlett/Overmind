type targetType = RoomObject; // overwrite this variable in derived classes to specify more precise typing

// Base class for creep tasks. Refactors creep_goTask implementation and is designed to be more extensible
export abstract class Task implements ITask {
    name: string;
    creepName: string;
    targetRef: string;
    targetCoords: { x: number | null; y: number | null; roomName: string; };
    maxPerTarget: number;
    maxPerTask: number;
    targetRange: number;
    moveColor: string;
    data: any;

    constructor(taskName: string, target: targetType) {
        // Parameters for the task
        this.name = taskName; // name of task
        this.creepName = ""; // name of creep assigned to task
        this.targetRef = ""; // id or name of target task is aimed at
        this.targetCoords = { // target's position, which is set on assignment and used for moving purposes
            x: null,
            y: null,
            roomName: "",
        };
        this.maxPerTarget = Infinity; // maximum number of creeps that can be assigned to a given target
        this.maxPerTask = Infinity; // maximum number of creeps that can be doing this task at once
        this.targetRange = 1; // range you need to be at to execute the task
        this.moveColor = '#fff';
        this.data = {
            quiet: true, // suppress console logging
            travelToOptions: {} // options for traveling
        };
        if (target) {
            this.target = target;
            this.targetPos = target.pos;
        } else {
            // This can sometimes trigger on things that delete the target with the action, like dismantle or pickup
            // console.log("Task.ts initialization error: target is null!");
        }
    }

    // Getter/setter for task.creep
    get creep(): ICreep { // Get task's own creep by its name
        return Game.icreeps[this.creepName];
    }

    set creep(creep: ICreep) {
        this.creepName = creep.name;
    }

    // Getter/setter for task.target
    get target(): RoomObject {
        let tar = deref(this.targetRef);
        if (!tar) {
            this.remove();
        } else {
            return tar;
        }
    }

    set target(target: RoomObject) {
        if (target) {
            this.targetRef = target.ref;
        } else {
            this.remove();
        }
    }

    // Getter/setter for task.targetPos
    get targetPos(): RoomPosition {
        // let position = this.target.pos; // refresh if you have visibility of the target
        if (this.target) {
            this.targetPos = this.target.pos;
        }
        return new RoomPosition(this.targetCoords.x!, this.targetCoords.y!, this.targetCoords.roomName);
    }

    set targetPos(targetPosition) {
        this.targetCoords.x = targetPosition.x;
        this.targetCoords.y = targetPosition.y;
        this.targetCoords.roomName = targetPosition.roomName;
    }

    // Remove the task (in case the target disappeared, usually)
    remove(): void {
        if (this.creep) {
            // this.creep.log("Deleting task " + this.name + ": target is null!");
            this.creep.task = null;
        }
    }

    // Test every tick to see if task is still valid
    abstract isValidTask(): boolean;

    // Test every tick to see if target is still valid
    abstract isValidTarget(): boolean;

    move(): number {
        var options = Object.assign({},
            this.data.travelToOptions,
            {range: this.targetRange});
        return this.creep.travelTo(this.target, options);
    }

    // Execute this task each tick. Returns nothing unless work is done.
    step(): number | void {
        var creep = this.creep;
        // if (!target) {
        //     this.creep.log('null target!');
        //     return null; // in case you're targeting something that just became invisible
        // }
        if (creep.pos.inRangeTo(this.targetPos, this.targetRange)) {
            var workResult = this.work();
            if (workResult != OK && this.data.quiet == false) {
                creep.log("Error executing " + this.name + ", returned " + workResult);
            }
            return workResult;
        } else {
            this.move();
        }
    }

    // Task to perform when at the target
    abstract work(): number;
}

import profiler = require('../lib/screeps-profiler'); profiler.registerClass(Task, 'Task');
