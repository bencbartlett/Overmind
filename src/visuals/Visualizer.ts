import {profile} from '../lib/Profiler';

@profile
export class Visualizer {

	static drawLayout(structureMap: StructureMap, roomName?: string): RoomVisual {
		let vis: RoomVisual;
		if (roomName) {
			vis = new RoomVisual(roomName);
		} else {
			vis = new RoomVisual();
		}
		for (let structureType in structureMap) {
			for (let pos of structureMap[structureType]) {
				vis.structure(pos.x, pos.y, structureType);
			}
		}
		vis.connectRoads();
		return vis;
	}

	static drawRoad(path: RoomPosition[]): void {
		let pointsByRoom = _.groupBy(path, pos => pos.roomName);
		for (let roomName in pointsByRoom) {
			let vis = new RoomVisual(roomName);
			for (let pos of pointsByRoom[roomName]) {
				vis.structure(pos.x, pos.y, STRUCTURE_ROAD);
			}
			vis.connectRoads();
		}
		// let roomName = _.first(path).roomName;
		// let vis = new RoomVisual(roomName);
		// for (let pos of path) {
		// 	if (pos.roomName != roomName) {
		// 		vis.connectRoads();
		// 		roomName = pos.roomName;
		// 		vis = new RoomVisual(roomName);
		// 	}
		// 	vis.structure(pos.x, pos.y, STRUCTURE_ROAD);
		// }
		// vis.connectRoads();
	}

	static drawPath(path: RoomPosition[], style?: PolyStyle): void {
		let pointsByRoom = _.groupBy(path, pos => pos.roomName);
		for (let roomName in pointsByRoom) {
			new RoomVisual(roomName).poly(pointsByRoom[roomName], style);
		}
	}

	static text(text: string, pos: RoomPosition, style?: TextStyle): void {
		new RoomVisual(pos.roomName).text(text, pos, style);
	}

	static drawHUD(): void {
		// Draw Overmind logo
		var fontSize;
		var style = {color: '#ffffff', align: 'left', opacity: 0.5, font: '1.0'} as TextStyle;
		var fontScale = 1.3;
		var row = 0;
		var column = 0;
		// Draw the logo
		fontSize = 0.3 * fontScale;
		style.font = fontSize + ' Courier';
		var asciiLogo = ['___________________________________________________________',
						 '',
						 ' _____  _    _ _______  ______ _______ _____ __   _ ______ ',
						 '|     |  \\  /  |______ |_____/ |  |  |   |   | \\  | |     \\',
						 '|_____|   \\/   |______ |    \\_ |  |  | __|__ |  \\_| |_____/',
						 '',
						 '___________________________________________________________'];
		row = 0;
		style.color = '#ffffff';
		row = new RoomVisual().multitext(asciiLogo, column, row, fontSize, style);
		row += 2 * fontSize;
		// Draw CPU info
		fontSize = 0.5 * fontScale;
		style.font = fontSize + ' Courier';
		// Display CPU Information
		new RoomVisual().text('CPU:' + ' bucket:' + Game.cpu.bucket +
							  ' tickLimit:' + Game.cpu.tickLimit, column, row, style);
		row += fontSize;
	}
}
