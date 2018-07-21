import {profile} from '../profiler/decorator';
import {StructureLayout, StructureMap} from '../roomPlanner/RoomPlanner';
import {asciiLogo} from './logos';

@profile
export class Visualizer {

	static get enabled(): boolean {
		return Memory.settings.enableVisuals;
	}

	static circle(pos: RoomPosition, color = 'red', opts = {}): RoomVisual {
		_.defaults(opts, {
			fill   : color,
			radius : 0.35,
			opacity: 0.5,
		});
		return new RoomVisual(pos.roomName).circle(pos.x, pos.y, opts);
	}

	static marker(pos: RoomPosition, opts = {}): RoomVisual {
		return new RoomVisual(pos.roomName).animatedPosition(pos.x, pos.y, opts);
	}

	static drawStructureMap(structureMap: StructureMap): void {
		if (!this.enabled) return;
		let vis: { [roomName: string]: RoomVisual } = {};
		for (let structureType in structureMap) {
			for (let pos of structureMap[structureType]) {
				if (!vis[pos.roomName]) {
					vis[pos.roomName] = new RoomVisual(pos.roomName);
				}
				vis[pos.roomName].structure(pos.x, pos.y, structureType);
			}
		}
		for (let roomName in vis) {
			vis[roomName].connectRoads();
		}
	}

	static drawLayout(layout: StructureLayout, anchor: RoomPosition): void {
		if (!this.enabled) return;
		let vis = new RoomVisual(anchor.roomName);
		for (let structureType in layout[8]!.buildings) {
			for (let pos of layout[8]!.buildings[structureType].pos) {
				let dx = pos.x - layout.data.anchor.x;
				let dy = pos.y - layout.data.anchor.y;
				vis.structure(anchor.x + dx, anchor.y + dy, structureType);
			}
		}
		vis.connectRoads();
	}

	static drawRoads(positoins: RoomPosition[]): void {
		let pointsByRoom = _.groupBy(positoins, pos => pos.roomName);
		for (let roomName in pointsByRoom) {
			let vis = new RoomVisual(roomName);
			for (let pos of pointsByRoom[roomName]) {
				vis.structure(pos.x, pos.y, STRUCTURE_ROAD);
			}
			vis.connectRoads();
		}
	}

	static drawPath(path: RoomPosition[], style?: PolyStyle): void {
		let pointsByRoom = _.groupBy(path, pos => pos.roomName);
		for (let roomName in pointsByRoom) {
			new RoomVisual(roomName).poly(pointsByRoom[roomName], style);
		}
	}

	static showInfo(info: string[], calledFrom: { room: Room | undefined, pos: RoomPosition }, opts = {}): RoomVisual {
		if (calledFrom.room) {
			return calledFrom.room.visual.infoBox(info, calledFrom.pos.x, calledFrom.pos.y, opts);
		} else {
			return new RoomVisual(calledFrom.pos.roomName).infoBox(info, calledFrom.pos.x, calledFrom.pos.y, opts);
		}
	}

	static text(text: string, pos: RoomPosition, style: TextStyle = {}): void {
		_.defaults(style, {
			font: '0.7 verdana',
		});
		new RoomVisual(pos.roomName).text(text, pos, style);
	}

	static drawHUD(): void {
		// Draw Overmind logo
		new RoomVisual().multitext(asciiLogo, 0, 0, {textfont: 'monospace'});
		// // Display CPU Information
		// new RoomVisual().text('CPU:' + ' bucket:' + Game.cpu.bucket +
		// 					  ' tickLimit:' + Game.cpu.tickLimit, column, row, style);
	}

	static colonyReport(colonyName: string, text: string[]) {
		if (!this.enabled) return;
		new RoomVisual(colonyName).multitext(text, 0, 4, {textfont: 'monospace', textsize: 0.75});
	}

	static visuals(): void {
		this.drawHUD();
	}
}
