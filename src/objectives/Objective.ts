// Objective - wrapper for task assignment
import {Task} from "../tasks/Task";

type targetType = RoomObject;

export abstract class Objective {
    name: string;
    target: targetType;

    constructor(name: string, target: targetType) {
        this.name = name;
        this.target = target;
    }

    abstract assignableTo(creep: Creep): boolean;

    abstract getTask(): Task;
}