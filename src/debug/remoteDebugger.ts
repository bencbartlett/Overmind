/* tslint:disable:no-eval */

import {log} from '../console/log';
import {Segmenter} from '../memory/Segmenter';
import {alignedNewline} from '../utilities/stringConstants';
import {color} from '../utilities/utils';
import {MUON, MY_USERNAME} from '../~settings';

const DEBUG_SEGMENT = 97;
const DEBUG_TIMEOUT = 1000;
const NO_COMMAND = 'No command';

interface DebuggerMemory {
	username: string | undefined;
	enabled: boolean;
	expiration: number;
	command: string | undefined;
	response: string | undefined;
}

const defaultDebuggerMemory: DebuggerMemory = {
	username  : undefined,
	enabled   : false,
	expiration: 0,
	command   : undefined,
	response  : undefined,
};

const DEBUGGER = color('[DEBUGGER]', '#ff00ff');

/**
 * Debugging tool which lets me remotely debug other Overmind players' code by communicating through public memory
 * segments. Can be toggled on and off with console commands startRemoteDebugSession() and endRemoteDebugSession().
 */
export class RemoteDebugger {

	constructor() {
		if (!Memory.remoteDebugger) {
			Memory.remoteDebugger = {};
		}
		_.defaultsDeep(Memory.remoteDebugger, defaultDebuggerMemory);
	}

	private get memory(): DebuggerMemory {
		return Memory.remoteDebugger;
	}

	/**
	 * Push all commands from secret memory to public memory and clear secret memory commands
	 */
	private pushCommands_master(): void {
		Segmenter.setSegmentProperty(DEBUG_SEGMENT, 'command', this.memory.command);
		if (this.memory.command) {
			log.info(`[DEBUGGER] Sending command: ${this.memory.command}`);
		}
		this.memory.command = undefined;
	}

	/**
	 * Fetch the response from the debugee
	 */
	private fetchResponse_master(): string | undefined {
		const response = Segmenter.getForeignSegmentProperty('response');
		return response;
	}

	/**
	 * Execute the commands you are given
	 */
	private fetchCommands_slave(): void {
		const cmd = Segmenter.getForeignSegmentProperty('command');
		if (cmd) {
			log.info(`[DEBUGGER] Executing command: ${cmd}`);
			const response = eval(cmd);
			log.info(`[DEBUGGER] Relaying response: ${response}`);
			this.memory.response = JSON.stringify(response);
		} else {
			this.memory.response = NO_COMMAND;
		}
	}

	/**
	 * Push the response from the last run command
	 */
	private pushResponse_slave(): void {
		Segmenter.setSegmentProperty(DEBUG_SEGMENT, 'response', this.memory.response);
		this.memory.response = undefined;
	}

	extendSession() {
		this.memory.expiration = Game.time + DEBUG_TIMEOUT;
	}

	enable() {
		this.memory.enabled = true;
		this.memory.expiration = Game.time + DEBUG_TIMEOUT;
		log.info(`[DEBUGGER] Starting remote debug session. Timeout: ${this.memory.expiration} ` + alignedNewline +
				 `Warning: this enables remote arbitrary code execution!`);
	}

	disable() {
		this.memory.enabled = false;
		this.memory.expiration = -1;
		log.info(`[DEBUGGER] Remote debugging session ended`);
	}


	connect(username: string) {
		this.memory.username = username;
		this.memory.enabled = true;
		this.memory.expiration = Game.time + DEBUG_TIMEOUT;
		log.info(`[DEBUGGER] Starting remote debug session with ${username}. Timeout: ${this.memory.expiration}`);
	}

	cancelCommand(): void {
		this.memory.command = undefined;
	}

	/* Register a debug command to be sent to the user */
	debug(command: string): string {
		this.memory.command = command;
		return `[DEBUGGER] Sending command next tick.`;
	}

	private run_master() {
		if (Game.time % 2 == 0) {
			const response = this.fetchResponse_master();
			if (response && response != NO_COMMAND) {
				log.info(`[DEBUGGER] Response: ` + response);
			}
			this.pushCommands_master();
		}
	}

	private run_slave() {
		if (Game.time % 2 == 1) {
			this.fetchCommands_slave();
			this.pushResponse_slave();
		}
	}

	run() {
		if (this.memory.enabled) {

			// Run the debugger
			if (MY_USERNAME == MUON) {
				if (this.memory.username) {
					Segmenter.requestSegments(DEBUG_SEGMENT);
					Segmenter.requestForeignSegment(this.memory.username, DEBUG_SEGMENT);
					Segmenter.markSegmentAsPublic(DEBUG_SEGMENT);
					this.run_master();
				}
			} else {
				Segmenter.requestSegments(DEBUG_SEGMENT);
				Segmenter.requestForeignSegment(MUON, DEBUG_SEGMENT);
				Segmenter.markSegmentAsPublic(DEBUG_SEGMENT);
				this.run_slave();
			}

			if (Game.time % 20 == 0) {
				log.alert(`[DEBUGGER] Remote session is still enabled! Expiration: ${this.memory.expiration}`);
			}

			// Disable after timeout
			if (!this.memory.expiration || Game.time > this.memory.expiration) {
				this.disable();
			}
		}
	}

}
