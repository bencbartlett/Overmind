Object.defineProperty(StructureTerminal.prototype, 'brain', {
    get () {
        //noinspection NodeModulesDependencies
        return Overmind.TerminalBrains[this.room.name];
    }
});
