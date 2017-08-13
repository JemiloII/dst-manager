const os = require('os');
const path = require('path');
const spawn = require('child_process').spawn;

function getArgs(server) {
    return [
        '-console',
        '-cluster', server,
        '-conf_dir', 'servers',
        '-persistent_storage_root', process.cwd(),
        '-monitor_parent_process', '$$',
        '-shard'
    ];
}

function getCaveArgs(server) {
    const args = getArgs(server);
    args.push('Caves');
    return args;
}

function getMasterArgs(server) {
    const args = getArgs(server);
    args.push('Master');
    return args;
}

function runMacStartScript(server) {
    console.log('Running on Mac!');
    const gamePath = path.join(__dirname, '../dontstarvetogether/dontstarve_dedicated_server_nullrenderer.app/Contents/MacOS/dontstarve_dedicated_server_nullrenderer');
    console.log('gamePath:', gamePath);

    return {
        caves: spawn(gamePath, getCaveArgs(server)),
        master: spawn(gamePath, getMasterArgs(server))
    };
}

function runWinStartScript() {
    console.log('Running on Windows!');
    return spawn('./start.bat');
}

function start(server = 'MyServer', platform = os.platform()) {
    console.log('platform:', platform);
    if (platform === 'darwin') {
        return runMacStartScript(server);
    }

    if (platform === 'win32') {
        return runWinStartScript(server);
    }
}

module.exports = start;

const stream = start();

stream.caves.stdout.on('data', data => console.log('caves:', data.toString()));
stream.master.stdout.on('data', data => console.log('master:', data.toString()));
// stream.error.on('data', error => console.error('Error:', error));
stream.caves.on('exit', code => console.log('Caves Exit:', code));
stream.master.on('exit', code => console.log('Master Exit:', code));