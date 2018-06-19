import {SourceMapConsumer} from 'source-map';
import {profile} from '../profiler/decorator';

export enum LogLevels {
	ERROR,		// log.level = 0
	WARNING,	// log.level = 1
	ALERT,		// log.level = 2
	INFO,		// log.level = 3
	DEBUG		// log.level = 4
}

/**
 * Debug level for log output
 */
export const LOG_LEVEL: number = LogLevels.DEBUG;

/**
 * Prepend log output with current tick number.
 */
export const LOG_PRINT_TICK: boolean = true;

/**
 * Prepend log output with source line.
 */
export const LOG_PRINT_LINES: boolean = false;

/**
 * Load source maps and resolve source lines back to typeascript.
 */
export const LOG_LOAD_SOURCE_MAP: boolean = false;

/**
 * Maximum padding for source links (for aligning log output).
 */
export const LOG_MAX_PAD: number = 100;

/**
 * VSC location, used to create links back to source.
 * Repo and revision are filled in at build time for git repositories.
 */
export const LOG_VSC = {repo: '@@_repo_@@', revision: '@@_revision_@@', valid: false};
// export const LOG_VSC = { repo: "@@_repo_@@", revision: __REVISION__, valid: false };

/**
 * URL template for VSC links, this one works for github and gitlab.
 */
export const LOG_VSC_URL_TEMPLATE = (path: string, line: string) => {
	return `${LOG_VSC.repo}/blob/${LOG_VSC.revision}/${path}#${line}`;
};

// <caller> (<source>:<line>:<column>)
const stackLineRe = /([^ ]*) \(([^:]*):([0-9]*):([0-9]*)\)/;

interface SourcePos {
	compiled: string;
	final: string;
	original: string | undefined;
	caller: string | undefined;
	path: string | undefined;
	line: number | undefined;
}

export function resolve(fileLine: string): SourcePos {
	const split = _.trim(fileLine).match(stackLineRe);
	if (!split || !Log.sourceMap) {
		return {compiled: fileLine, final: fileLine} as SourcePos;
	}

	const pos = {column: parseInt(split[4], 10), line: parseInt(split[3], 10)};

	const original = Log.sourceMap.originalPositionFor(pos);
	const line = `${split[1]} (${original.source}:${original.line})`;
	const out = {
		caller  : split[1],
		compiled: fileLine,
		final   : line,
		line    : original.line,
		original: line,
		path    : original.source,
	};

	return out;
}

function makeVSCLink(pos: SourcePos): string {
	if (!LOG_VSC.valid || !pos.caller || !pos.path || !pos.line || !pos.original) {
		return pos.final;
	}

	return link(vscUrl(pos.path, `L${pos.line.toString()}`), pos.original);
}

function color(str: string, color: string): string {
	return `<font color='${color}'>${str}</font>`;
}

function tooltip(str: string, tooltip: string): string {
	return `<abbr title='${tooltip}'>${str}</abbr>`;
}

function vscUrl(path: string, line: string): string {
	return LOG_VSC_URL_TEMPLATE(path, line);
}

function link(href: string, title: string): string {
	return `<a href='${href}' target="_blank">${title}</a>`;
}

function time(): string {
	return color(Game.time.toString(), 'gray');
}

@profile
export class Log {
	public static sourceMap: any;

	public static loadSourceMap() {
		try {
			// tslint:disable-next-line
			const map = require('main.js.map');
			if (map) {
				Log.sourceMap = new SourceMapConsumer(map);
			}
		} catch (err) {
			console.log('failed to load source map', err);
		}
	}

	public get level(): number {
		return Memory.log.level;
	}

	public setLogLevel(value: number) {
		let changeValue = true;
		switch (value) {
			case LogLevels.ERROR:
				console.log(`Logging level set to ${value}. Displaying: ERROR.`);
				break;
			case LogLevels.WARNING:
				console.log(`Logging level set to ${value}. Displaying: ERROR, WARNING.`);
				break;
			case LogLevels.ALERT:
				console.log(`Logging level set to ${value}. Displaying: ERROR, WARNING, ALERT.`);
				break;
			case LogLevels.INFO:
				console.log(`Logging level set to ${value}. Displaying: ERROR, WARNING, ALERT, INFO.`);
				break;
			case LogLevels.DEBUG:
				console.log(`Logging level set to ${value}. Displaying: ERROR, WARNING, ALERT, INFO, DEBUG.`);
				break;
			default:
				console.log(`Invalid input: ${value}. Loging level can be set to integers between `
							+ LogLevels.ERROR + ' and ' + LogLevels.DEBUG + ', inclusive.');
				changeValue = false;
				break;
		}
		if (changeValue) {
			Memory.log.level = value;
		}
	}

	public get showSource(): boolean {
		return Memory.log.showSource;
	}

	public set showSource(value: boolean) {
		Memory.log.showSource = value;
	}

	public get showTick(): boolean {
		return Memory.log.showTick;
	}

	public set showTick(value: boolean) {
		Memory.log.showTick = value;
	}

	private _maxFileString: number = 0;

	constructor() {
		_.defaultsDeep(Memory, {
			log: {
				level     : LOG_LEVEL,
				showSource: LOG_PRINT_LINES,
				showTick  : LOG_PRINT_TICK,
			}
		});
	}

	public trace(error: Error): Log {
		if (this.level >= LogLevels.ERROR && error.stack) {
			console.log(this.resolveStack(error.stack));
		}

		return this;
	}

	public error(...args: any[]) {
		if (this.level >= LogLevels.ERROR) {
			console.log.apply(this, this.buildArguments(LogLevels.ERROR).concat([].slice.call(args)));
		}
	}

	public warning(...args: any[]) {
		if (this.level >= LogLevels.WARNING) {
			console.log.apply(this, this.buildArguments(LogLevels.WARNING).concat([].slice.call(args)));
		}
	}

	public alert(...args: any[]) {
		if (this.level >= LogLevels.ALERT) {
			console.log.apply(this, this.buildArguments(LogLevels.ALERT).concat([].slice.call(args)));
		}
	}

	public info(...args: any[]) {
		if (this.level >= LogLevels.INFO) {
			console.log.apply(this, this.buildArguments(LogLevels.INFO).concat([].slice.call(args)));
		}
	}

	public debug(...args: any[]) {
		if (this.level >= LogLevels.DEBUG) {
			console.log.apply(this, this.buildArguments(LogLevels.DEBUG).concat([].slice.call(args)));
		}
	}

	public printObject(obj: any) {
		console.log.apply(this, this.buildArguments(LogLevels.DEBUG).concat(JSON.stringify(obj)));
	}

	public getFileLine(upStack = 4): string {
		const stack = new Error('').stack;

		if (stack) {
			const lines = stack.split('\n');

			if (lines.length > upStack) {
				const originalLines = _.drop(lines, upStack).map(resolve);
				const hoverText = _.map(originalLines, 'final').join('&#10;');
				return this.adjustFileLine(
					originalLines[0].final,
					tooltip(makeVSCLink(originalLines[0]), hoverText)
				);
			}
		}
		return '';
	}

	private buildArguments(level: number): string[] {
		const out: string[] = [];
		switch (level) {
			case LogLevels.ERROR:
				out.push(color('ERROR  ', 'red'));
				break;
			case LogLevels.WARNING:
				out.push(color('WARNING', 'orange'));
				break;
			case LogLevels.ALERT:
				out.push(color('ALERT  ', 'yellow'));
				break;
			case LogLevels.INFO:
				out.push(color('INFO   ', 'green'));
				break;
			case LogLevels.DEBUG:
				out.push(color('DEBUG  ', 'gray'));
				break;
			default:
				break;
		}
		if (this.showTick) {
			out.push(time());
		}
		if (this.showSource && level <= LogLevels.ERROR) {
			out.push(this.getFileLine());
		}
		return out;
	}

	private resolveStack(stack: string): string {
		if (!Log.sourceMap) {
			return stack;
		}

		return _.map(stack.split('\n').map(resolve), 'final').join('\n');
	}

	private adjustFileLine(visibleText: string, line: string): string {
		const newPad = Math.max(visibleText.length, this._maxFileString);
		this._maxFileString = Math.min(newPad, LOG_MAX_PAD);

		return `|${_.padRight(line, line.length + this._maxFileString - visibleText.length, ' ')}|`;
	}
}

if (LOG_LOAD_SOURCE_MAP) {
	Log.loadSourceMap();
}

export const log = new Log();

