type targetType = RoomObject; // overwrite this variable in derived classes to specify more precise typing

// Base class for creep tasks. Refactors creep_goTask implementation and is designed to be more extensible
export abstract class Task implements ITask {
    name: string;
    creepName: string;
    targetRef: string;
    targetCoords: { x: number; y: number; roomName: string; };
    maxPerTarget: number;
    maxPerTask: number;
    targetRange: number;
    moveColor: string;
    data: any;

    constructor(taskName: string, target: targetType) {
        // Parameters for the task
        this.name = taskName; // name of task
        this.creepName = null; // name of creep assigned to task
        this.targetRef = null; // id or name of target task is aimed at
        this.targetCoords = { // target's position, which is set on assignment and used for moving purposes
            x: null,
            y: null,
            roomName: null,
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
        }
    }

    // Getter/setter for task.creep
    get creep(): Creep { // Get task's own creep by its name
        return Game.creeps[this.creepName];
    }

    set creep(creep: Creep) {
        this.creepName = creep.name;
    }

    // Getter/setter for task.target
    get target(): RoomObject {
        let tar = deref(this.targetRef);
        if (tar) {
            return tar;
        } else {
            if (this.creep) {
                this.creep.task = null;
            }
        }
    }

    set target(target: RoomObject) {
        if (target) {
            this.targetRef = target.ref;
        } else {
            if (this.creep) {
                this.creep.task = null;
            }
        }
    }

    // Getter/setter for task.targetPos
    get targetPos(): RoomPosition {
        // let position = this.target.pos; // refresh if you have visibility of the target
        if (this.target) {
            this.targetPos = this.target.pos;
        }
        return new RoomPosition(this.targetCoords.x, this.targetCoords.y, this.targetCoords.roomName);
    }

    set targetPos(targetPosition) {
        this.targetCoords.x = targetPosition.x;
        this.targetCoords.y = targetPosition.y;
        this.targetCoords.roomName = targetPosition.roomName;
    }

    // Assign the task to a creep
    assign(creep: Creep): string {
        // add target to Memory.preprocessing
        if (!Memory.preprocessing.targets[this.target.ref]) {
            Memory.preprocessing.targets[this.target.ref] = [];
        }
        Memory.preprocessing.targets[this.target.ref].push(creep.name);
        // register references to creep and target
        this.creep = creep;
        creep.memory.task = this; // serializes the searalizable portions of the task into memory
        this.onAssignment();
        return this.name;
    }

    // Action to do on assignment
    onAssignment(): void {
        // override if needed
        var creep = this.creep;
        if (this.data.quiet == false) {
            creep.log("assigned to " + this.name + " " + this.target + ".");
            creep.say(this.name);
        }
    }

    // Test every tick to see if task is still valid
    abstract isValidTask(): boolean;

    // Test every tick to see if target is still valid
    abstract isValidTarget(): boolean;

    move(): number {
        // var options = {
        //     visualizePathStyle: {
        //         fill: 'transparent',
        //         stroke: this.moveColor,
        //         lineStyle: 'dashed',
        //         strokeWidth: .15,
        //         opacity: .3
        //     }
        // };
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
