// Helper methods for Game.map
// Much of this code was taken with slight modification from BonzAI codebase

import {profile} from '../profiler/decorator';

export const ROOMTYPE_SOURCEKEEPER = 'SK';
export const ROOMTYPE_CORE = 'CORE';
export const ROOMTYPE_CONTROLLER = 'CTRL';
export const ROOMTYPE_ALLEY = 'ALLEY';

@profile
export class WorldMap {

	public static roomType(roomName: string): string {
		let coords = this.getRoomCoordinates(roomName);
		if (coords.x % 10 === 0 || coords.y % 10 === 0) {
			return ROOMTYPE_ALLEY;
		} else if (coords.x % 5 === 0 && coords.y % 5 === 0) {
			return ROOMTYPE_CORE;
		} else if (coords.x % 10 <= 6 && coords.x % 10 >= 4 && coords.y % 10 <= 6 && coords.y % 10 >= 4) {
			return ROOMTYPE_SOURCEKEEPER;
		} else {
			return ROOMTYPE_CONTROLLER;
		}
	}

	public static findRelativeRoomName(roomName: string, xDelta: number, yDelta: number): string {
		let coords = this.getRoomCoordinates(roomName);
		let xDir = coords.xDir;
		if (xDir === 'W') {
			xDelta = -xDelta;
		}
		let yDir = coords.yDir;
		if (yDir === 'N') {
			yDelta = -yDelta;
		}
		let x = coords.x + xDelta;
		let y = coords.y + yDelta;
		if (x < 0) {
			x = Math.abs(x) - 1;
			xDir = this.oppositeDir(xDir);
		}
		if (y < 0) {
			// noinspection JSSuspiciousNameCombination
			y = Math.abs(y) - 1;
			yDir = this.oppositeDir(yDir);
		}

		return xDir + x + yDir + y;
	}

	public static findRoomCoordDeltas(origin: string, otherRoom: string): { x: number, y: number } {
		let originCoords = this.getRoomCoordinates(origin);
		let otherCoords = this.getRoomCoordinates(otherRoom);

		let xDelta = otherCoords.x - originCoords.x;
		if (originCoords.xDir !== otherCoords.xDir) {
			xDelta = otherCoords.x + originCoords.x + 1;
		}

		let yDelta = otherCoords.y - originCoords.y;
		if (originCoords.yDir !== otherCoords.yDir) {
			yDelta = otherCoords.y + originCoords.y + 1;
		}

		// normalize direction
		if (originCoords.xDir === 'W') {
			xDelta = -xDelta;
		}
		if (originCoords.yDir === 'N') {
			yDelta = -yDelta;
		}

		return {x: xDelta, y: yDelta};
	}

	public static findRelativeRoomDir(origin: string, otherRoom: string): number {
		let coordDeltas = this.findRoomCoordDeltas(origin, otherRoom);
		// noinspection JSSuspiciousNameCombination
		if (Math.abs(coordDeltas.x) == Math.abs(coordDeltas.y)) {
			if (coordDeltas.x > 0) {
				if (coordDeltas.y > 0) {
					return 2;
				} else {
					return 4;
				}
			} else if (coordDeltas.x < 0) {
				if (coordDeltas.y > 0) {
					return 8;
				} else {
					return 6;
				}
			} else {
				return 0;
			}
		} else {
			// noinspection JSSuspiciousNameCombination
			if (Math.abs(coordDeltas.x) > Math.abs(coordDeltas.y)) {
				if (coordDeltas.x > 0) {
					return 3;
				} else {
					return 7;
				}
			} else {
				if (coordDeltas.y > 0) {
					return 1;
				} else {
					return 5;
				}
			}
		}
	}

	public static oppositeDir(dir: string): string {
		switch (dir) {
			case 'W':
				return 'E';
			case 'E':
				return 'W';
			case 'N':
				return 'S';
			case 'S':
				return 'N';
			default:
				return 'error';
		}
	}

	public static getRoomCoordinates(roomName: string): RoomCoord {
		let coordinateRegex = /(E|W)(\d+)(N|S)(\d+)/g;
		let match = coordinateRegex.exec(roomName)!;

		let xDir = match[1];
		let x = match[2];
		let yDir = match[3];
		let y = match[4];

		return {
			x   : Number(x),
			y   : Number(y),
			xDir: xDir,
			yDir: yDir,
		};
	}

}