// import {Task} from "./Task";

export interface protoCreep {
    body: string[];
    name: string;
    memory: any;
}

export interface creepCall {
    assignment: RoomObject;
    workRoom: string;
    patternRepetitionLimit: number;
}