'use strict';

var fsPath = require('path'),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    debug = require('debug')('marionette-socket-host:events');

var uuid = require('uuid');
var waitForEvent = require('./lib/wait_for_event');
var request = require('./lib/request');

var PassThrough = require('stream').PassThrough;
var EventEmitter = require('events').EventEmitter;
var Promise = require('promise');

var detectBinary =
  Promise.denodeify(require('mozilla-runner/lib/detectbinary').detectBinary);

var DEFAULT_LOCATION = fsPath.join(process.cwd(), 'b2g');
var VENV = __dirname + '/venv';

/**
Wrapper for spawning a python process which expects a venv with particular
packages. Same interface as spawn but overrides path and ensures certain env
variables are not set which conflict.

@param {String} bin path to binary to execute.
@param {Array} argv list of arguments.
@param {Object} opts options for node's spawn.
@return {ChildProcess}
*/
function spawnVirtualEnv(bin, argv, opts) {
  opts = opts || {};
  // Clone current environment variables...
  var env = opts.env = {};
  for (var key in process.env) env[key] = process.env[key];

  // Add binary wrappers to top most of the path...
  env['PATH'] = __dirname + '/../venv/bin/:' + process.env.PATH;

  // Ensure we don't conflict with other wrappers or package managers.
  delete env['PYTHONHOME'];

  return spawn(bin, argv, opts);
}

/**
Figure out where the b2g-bin lives based on options.

@param {Object} options (as described by .help).
@return {Promise<Null|String>} null if none is needed or a path.
*/
function resolveBinary(options) {
  return Promise.resolve().then(function() {
    if (options.buildapp !== 'desktop') return;
    if (options.runtime) return options.runtime;

    return detectBinary(options.target || DEFAULT_LOCATION, { product: 'b2g' });
  });
}

/**
 * Host interface for marionette-js-runner.
 *
 * @constructor
 * @param {Object} options for host that get forwarded over the socket.
 */
function Host(options) {
  // TODO: host api should have some concept of a "asset" directory
  //       where we can stuff b2g-desktop without saving it in node_modules or
  //       cwd.

  this.options = options || {};
  this.process = null;
  this.socketPath = null;
  this.events = null;
  this.id = null;
}

/**
 * Immutable metadata describing this host.
 *
 * @type {Object}
 */
Host.metadata = Object.freeze({
  host: 'socket'
});

Host.help = {
  group: {
    title: 'Socket Host',
    description: 'Socket host uses mozbase to manage gecko applications.'
  },
  arguments: {
    '--serial': {
      dest: 'device_serial',
      defaultValue: null,
      help: 'Serial port (only with buildapp=device)',
      type: 'string'
    },

    '--symbols-path': {
      dest: 'symbols_path',
      help: 'Path to build symbols used by crash reporting.',
      defaultValue: null,
      type: 'string'
    },

    '--b2gpath': {
      dest: 'b2g_home',
      help: 'Path to b2g directory.',
      defaultValue: null,
      type: 'string'
    },

    '--buildapp': {
      type: 'string',
      choices: ['device', 'desktop', 'emulator'],
      defaultValue: 'desktop',
      help: 'Type of gecko application to run.'
    },

    '--runtime': {
      defaultValue: null,
      help: 'Path to b2g-bin when using buildapp=desktop'
    },

    '--dump-path': {
      dest: 'dump_path',
      defaultValue: null,
      help: 'path in which to store crash dumps. Will default to ' +
            "the 'minidumps' directory in the current working directory"
    },

    '--chrome': {
      defaultValue: 'chrome://b2g/content/shell.html',
      help: '--chrome option to set when starting b2g-desktop'
    }
  }
};

Host.prototype = {
  /**
   * Starts the device/b2g-desktop process.
   *
   * @param {String} profile path.
   * @param {Object} [options] settings provided by caller.
   * @param {Function} callback [Error err].
   */
  start: Promise.nodeify(function(profile, options) {
    // start is cached so we do not run stop before start has actually finished!
    this._startInProgress = new Promise(function(accept, reject) {
      debug('start called with: ', profile, options);

      // Merge options/defaults...
      var startOptions = {};
      for (var key in this.options) startOptions[key] = this.options[key];
      for (var key in options) startOptions[key] = options[key];
      startOptions.profile = startOptions.profile || profile;
      startOptions.buildapp = startOptions.buildapp || 'desktop';

      if (startOptions.b2g_home && startOptions.buildapp === 'desktop') {
        throw new Error(
          'Can only specify --b2gpath with a device or emulator buildapp.'
        );
      }

      if (!startOptions.b2g_home && startOptions.buildapp === 'emulator') {
        throw new Error(
          'Can only specify --b2gpath with a device or emulator buildapp.'
        );
      }

      // Log stream for any data the process sends...
      var log = new PassThrough();
      // Allow multiple servers to exist concurrently...
      this.socketPath = '/tmp/marionette-socket-host-' + uuid.v1() + '.sock';

      var pythonChild = spawnVirtualEnv(
        __dirname + '/../venv/bin/gaia-integration',
        ['--path=' + this.socketPath],
        { stdio: 'pipe', env: process.env }
      );

      // Until we get ready start any errors will trigger the callback.
      pythonChild.on('error', function(err) {
        reject(err);
      });

      // Ensure if we exit for some reason during boot errors are reported...
      function earlyExitHandler() {
        // Ensure we don't call error callbck somehow...
        pythonChild.removeListener('error', reject);
        reject(new Error('Unexpected exit of gaia-integration'), { log: log });
      }

      pythonChild.once('exit', earlyExitHandler);

      this.process = pythonChild;

      // This looks strange because it is any kind of backpressure from the log
      // seems to cause freezes in gecko (or maybe the node process) so we
      // always buffer the writes in memory.
      pythonChild.stdout.on('data', log.write.bind(log));
      pythonChild.stderr.on('data', log.write.bind(log));

      var socketEvents;
      var start = Date.now();
      resolveBinary(startOptions)
        .then(function onBinary(binary) {
          return request(this.socketPath, '/start_runner', {
            binary: binary,
            options: startOptions
          });
        }.bind(this))
        .then(function onReadyStart(result) {
          this._startInProgress = null;
          this.id = result.id;
          // Now that we are in a successful state do not trip on errors in the
          // child process which may be intentional at this point.
          pythonChild.removeListener('exit', earlyExitHandler);
          pythonChild.removeListener('error', reject);
          return { log: log };
        }.bind(this))
        // pass any success status upstream.
        .then(accept)
        // or any errors this promise chain encounters.
        .catch (reject);
    }.bind(this));

    return this._startInProgress;
  }),

  /**
   * Stop the currently running host.
   *
   * @param {Function} callback [Error err].
   */
  stop: Promise.nodeify(function() {
    // Wait for start to complete before running stop...
    if (this._startInProgress) {
      return this._startInProgress.then(this.stop.bind(this));
    }

    if (this._stopInProgress) {
      return this._stopInProgress;
    }

    var payload = { id: this.id };

    this._stopInProgress = request(this.socketPath, '/stop_runner', payload)
      .then(function afterReadyStop() {
        this.process.kill();
        return waitForEvent(this.process, 'exit');
      }.bind(this))
      .then(function afterProcessEnd() {
        this._stopInProgress = this.events = this.socket = this.process = null;
      }.bind(this));

    return this._stopInProgress;
  })
};

module.exports = Host;
