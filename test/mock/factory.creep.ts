/* tslint:disable:no-reference */
/// <reference path="../../typings/globals/screeps/index.d.ts"/>
import * as _ from "lodash";

export class CreepFactory {
  private _body: BodyPartDefinition[];
  private _carry: StoreDefinition;
  private _carryCapacity: number;
  private _fatigue: number;
  private _hits: number;
  private _hitsMax: number;
  private _id: string;
  private _memory: any;
  private _my: boolean;
  private _name: string;
  private _owner: Owner;
  private _room: Room;
  private _spawning: boolean;
  private _saying: string;
  private _ticksToLive: number;

  public build(): Creep {

    let capacity = this._carryCapacity;
    if (!capacity && _.isArray(this._body)) {
      capacity = _.filter(this._body, (p: any) => p === CARRY).length * CARRY_CAPACITY;
    }
    return {
      body: this._body,
      carry: this._carry,
      carryCapacity: capacity,
      fatigue: this._fatigue,
      hits: this._hits,
      hitsMax: this._hitsMax,
      id: this._id,
      memory: this._memory || {},
      my: this._my,
      name: this._name,
      owner: this._owner,
      room: this._room,
      saying: this._saying,
      spawning: this._spawning,
      ticksToLive: this._ticksToLive,
    } as Creep;
  }

  public body(body: any): CreepFactory {
    this._body = body;
    return this;
  }

  public carrying(type: StoreDefinition | string, amount?: number): CreepFactory {
    if (!amount) {
      this._carry = type as StoreDefinition;
    } else if (typeof type === "string") {
      const c: any = {};
      c[type] = amount;
      this._carry = c as StoreDefinition;
    }
    return this;
  }

  public carryCapacity(capactiy: number): CreepFactory {
    this._carryCapacity = capactiy;
    return this;
  }

  public fatigue(fatigue: number): CreepFactory {
    this._fatigue = fatigue;
    return this;
  }

  public hits(hits: number): CreepFactory {
    this._hits = hits;
    return this;
  }

  public hitsMax(hitsMax: number): CreepFactory {
    this._hitsMax = hitsMax;
    return this;
  }

  public id(id: string): CreepFactory {
    this._id = id;
    return this;
  }

  public memory(memory: any): CreepFactory {
    this._memory = memory;
    return this;
  }

  public my(my: boolean): CreepFactory {
    this._my = my;
    return this;
  }

  public name(name: string): CreepFactory {
    this._name = name;
    return this;
  }

  public owner(owner: Owner): CreepFactory {
    this._owner = owner;
    return this;
  }

  public room(room: Room): CreepFactory {
    this._room = room;
    return this;
  }

  public spawning(spawning: boolean): CreepFactory {
    this._spawning = spawning;
    return this;
  }

  public saying(saying: string): CreepFactory {
    this._saying = saying;
    return this;
  }

  public ticksToLive(ticksToLive: number): CreepFactory {
    this._ticksToLive = ticksToLive;
    return this;
  }
}
