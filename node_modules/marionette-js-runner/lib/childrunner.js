var assert = require('assert');
var debug = require('debug')('marionette-js-runner:childrunner');
var emptyPort = require('empty-port');
var fsPath = require('path');
var fork = require('child_process').fork;
var reporter = require('mocha-json-proxy/reporter');
var resolveModule = require('./resolvemodule');

var Consumer = require('mocha-json-proxy/consumer');
var Logger = require('marionette-js-logger');
var Marionette = require('marionette-client');

// resolve module paths (required otherwise stuff breaks when the
// marionette-mocha binary is invoked outside of this package.
// Paths cannot be found via their relative module names. (mocha vs
// ./node_modules/mocha)
var MOCHA_BINARY = resolveModule('mocha', 'bin', '_mocha');
var PROXY_BINARY = resolveModule('mocha-json-proxy', 'reporter.js');

var STARTING_PORT = 60030;
var MARIONETTE_ENABLED_PREF = 'marionette.defaultPrefs.enabled';
var MARIONETTE_PORT_PREF = 'marionette.defaultPrefs.port';

/**
 * Mocha child instance- responsible for managing hosts (in
 * this process) and then spawning a separate process for the
 * mocha tests to run in...
 *
 *
 *    var child = new Child({
 *      argv: process.argv.slice(1)
 *    });
 *
 *    var childProcess = child.run();
 *
 * Options
 *  - (Array) argv: argv for mocha.
 *  - (Function) Host: class
 *  - (Function) ProfileBuilder: class
 *  - (Object) profileBase: options to use for all builds.
 *
 * @constructor
 * @param {Options} options for process.
 */
function ChildRunner(options) {
  assert(options.argv, '.argv is required');
  assert(options.host, '.host is required');
  assert(options.hostLog, '.hostLog is required');
  assert(options.profileBuilder, '.profileBuilder is required');

  this.argv = options.argv;
  this.host = options.host;
  this.hostLog = options.hostLog;
  this.profileBuilder = options.profileBuilder;

  // base details used in every profile
  this.profileBase = options.profileBase;

  this._nextRemoteId = 1;
  this._verbose = !!options.verbose;
  this.remotes = {};
}


ChildRunner.prototype = {
  /**
   * Next host id to use. Number will increase monotonically.
   *
   * @type Number
   */
  _nextRemoteId: 1,

  /**
   * Remote objects related to a given remote id.
   * Typically in the form of:
   *
   *    {
   *      id: { id: id, host: host, profileBuilder: builder }
   *    }
   *
   *
   * @type {Object}
   */
  remotes: null,

  /**
   * Whether or not to proxy console.* logs from gecko.
   * @type {boolean}
   * @private
   */
  _verbose: false,

  /**
   * argv input for the mocha process.
   *
   * @type {Array}
   */
  argv: null,

  /**
   * Host class for this child.
   *
   * @type {Function}
   */
  Host: null,

  /**
   * Profile Builder class for this child.
   *
   * @type {Function}
   */
  ProfileBuilder: null,

  /**
   * Default details for all profiles.
   *
   * @type {Object}
   */
  profileBase: null,

  /**
   * mocha-json-proxy consumer instance.
   *
   * @type {Consumer} runner.
   */
  runner: null,

  /**
   * @param {Object} remote details.
   * @return {Object} properties for host.
   */
  _remoteDetails: function(remote) {
    return {
      metadata: this.host.constructor.metadata,
      port: remote.port,
      id: remote.id,
      verbose: remote.verbose
    };
  },

  /**
   * Creates a wrapper function around a IPC response.
   *
   * @param {Stirng} uniqueId for IPC request.
   * @return {Function} callback like function.
   */
  _buildIPCCallback: function(uniqueId) {
    var child = this.process;
    return function() {
      var args = Array.prototype.slice.call(arguments);
      return child.send(['response', uniqueId].concat(args));
    };
  },

  /**
   * Attempts to find a remote by its index or throw.
   *
   * @param {number} id some id to lookup remote by.
   * @return {Object} remote.
   */
  _findRemote: function(id) {
    var remote = this.remotes[id];
    if (!remote) {
      throw new Error('invalid host lookup: "' + id + '"');
    }

    return remote;
  },

  /**
   * Finds an open port and generates a profile then invokes the given
   * profile builder / host methods.
   *
   * @param {String} builderMethod method to invoke on profile builder.
   * @param {String} hostMethod method to invoke on host.
   * @param {Object} overrides for profile builder.
   * @param {Object} remote which is target of build.
   * @param {Function} callback to invoke once calls are complete.
   */
  _buildRemote: function(builderMethod,
                         hostMethod,
                         overrides,
                         remote,
                         callback) {
    // find an open port to use.
    emptyPort({ startPort: STARTING_PORT }, function(err, port) {
      if (err) return callback(err);
      // set or update the port
      remote.port = port;

      // XXX: allow specifying profile overrides here
      var profileOptions = this.profileOptions(port, overrides);
      var builder = remote.profileBuilder;
      var host = remote.host;

      // create the profile
      builder[builderMethod](profileOptions, function(err, profile) {
        if (err) return callback(err);
        // start the host
        host[hostMethod](
          profile, profileOptions.hostOptions, function(err, hostOpts) {
          if (err) return callback(err);

          var remoteDetails = this._remoteDetails(remote);
          if (!this._verbose) {
            return callback(null, remoteDetails, hostOpts);
          }

          var driver = new Marionette.Drivers.Tcp({ port: port });
          driver.connect(function() {
            var client = new Marionette.Client(driver);
            client.plugin('logger', Logger);
            client.startSession(function() {
              remote.logger = client.logger;
              client.deleteSession(function() {
                callback(null, remoteDetails, hostOpts);
              });
            });
          });
        }.bind(this));
      }.bind(this));

    }.bind(this));
  },

  /**
   * Handles an IPC request.
   *
   * Usual payload looks like this:
   *
   *    ['name of event', requestId, ...]
   *
   * All responses take the following form:
   *
   *    ['response', requestId, ...]
   *
   * @param {Array} event data.
   */
  handleIPC: function(event) {
    var method = event.shift();

    // if this is not an available method abort.
    if (!(method in this)) {
      // XXX: in the future should send some error for missing IPC methods?
      debug('missing IPC method', method);
      return;
    }

    var requestId = event.shift(),
        callback = this._buildIPCCallback(requestId);

    debug('invoke ipc method', method, requestId, event);

    // invoke method with special "callback" which will emit data to the child
    // process.
    this[method].apply(this, event.concat(callback));
  },

  /**
   * Generates the default set of profile options.
   *
   * @param {Number} port for marionette connection.
   * @param {Object} options for build.
   * @return {Object} full configuration for build.
   */
  profileOptions: function(port, options) {
    options = options || {};
    options.prefs = options.prefs || {};
    options.hostOptions = options.hostOptions || {};
    options.hostOptions.port = port;

    options.prefs[MARIONETTE_ENABLED_PREF] = true;
    options.prefs[MARIONETTE_PORT_PREF] = port;

    return options;
  },

  /**
   * Create a remote host and add it to the remotes index.
   *
   * @param {Object} overrides for profile generation.
   * @param {Function} callback [Error err, remoteId].
   */
  createHost: function(overrides, callback) {
    var id = ++this._nextRemoteId;

    // XXX: allow passing default options to host and profile builder.
    var host = new this.host.constructor(this.host.options);
    var builder = new this.profileBuilder.constructor(this.profileBase);

    // save copy of records in this process to be referenced later.
    var remote = this.remotes[id] = {
      id: id,
      host: host,
      profileBuilder: builder
    };

    function onCreateHost(childrunner, err, host, createOpts) {
      if (err) return callback(err);
      // The host may have a log which we should pipe to hostLog.
      if (createOpts && createOpts.log) {
        // XXX: Piping here will drain if we want per-test logs we need to
        // reconfigure this to pipe to a pipe then drain that (or something
        // similarly fancy).
        createOpts.log.pipe(childrunner.hostLog);
      }
      callback(null, host);
    }

    this._buildRemote(
      'build', // profile method
      'start', // host method,
      overrides,
      remote,
      onCreateHost.bind(null, this)
    );
  },

  /**
   * Restarts a single host by id.
   *
   * @param {Number} remoteId unique id for single host in this child.
   * @param {Object} overrides for profile.
   * @param {Function} callback [Error err].
   * @return {Boolean} true is remote restarts successfully
   */
  restartHost: function(remoteId, overrides, callback) {
    var remote;

    try {
      remote = this._findRemote(remoteId);
    } catch (err) {
      callback(err);
      return;
    }

    this.stopHost(remoteId, function(err) {
      if (err) return callback(err);
      this._buildRemote(
        'build', // profile method
        'start', // host method,
        overrides,
        remote,
        callback
      );
    }.bind(this));

    return remote.logger && remote.logger.close();
  },

  /**
   * Stops a single host by id.
   *
   * @param {Number} remoteId unique id for single host in this child.
   * @param {Function} callback [Error err].
   */
  stopHost: function(remoteId, callback) {
    var remote;

    try {
      remote = this._findRemote(remoteId);
    } catch (err) {
      callback(err);
      return;
    }

    remote.host.stop(function(err) {
      if (err) return callback(err);
      remote.profileBuilder.destroy(callback);
    });
  },

  teardownHost: function(remoteId, callback) {
    var remote;

    try {
      remote = this._findRemote(remoteId);
    } catch (err) {
      callback(err);
      return;
    }

    if (typeof remote.host.teardown === 'function') {
      remote.host.teardown(callback);
    } else {
      callback();
    }
  },

  /**
   * Cleanup the hosts and all remaining state.
   *
   *  - stops all the hosts
   *  - removes all remotes
   *
   * @param {Function} callback [Error]
   */
  cleanup: function(callback) {
    var pending = 1;

    function next() {
      if (--pending === 0) {
        return callback && callback();
      }
    }

    for (var id in this.remotes) {
      pending++;
      this.stopHost(id, next);
      delete this.remotes[id];
    }

    // handle the case where there are no remotes.
    process.nextTick(next);
  },

  /**
   * Spawn the process for the mocha child runner.
   */
  spawn: function() {
    // reporter must come after everything else to override a previous reporter
    var argv = this.argv.concat(
      ['--reporter', PROXY_BINARY]
    );

    // encode the metadata in base64 + json
    var metadata = new Buffer(
      JSON.stringify(this.host.constructor.metadata)
    ).toString('base64');

    // pass all environment variables to the child...
    var env = {};
    for (var key in process.env) {
      env[key] = process.env[key];
    }
    env.CHILD_METADATA = metadata;

    var options = {
      env: env,
      // silent is similar to stdio: ['pipe', 'pipe'] + an ipc channel (send).
      silent: true
    };

    // turn on the fork options so we get ipc messages.
    options.env[reporter.FORK_ENV] = 1;

    this.process = fork(MOCHA_BINARY, argv, options);
    this.runner = new Consumer(this.process);

    // must come after constructing the consumer otherwise messages
    // are sent before the consumer is ready to receive them.
    this.process.on('message', this.handleIPC.bind(this));
    this.process.on('exit', function() {
      this.cleanup();
      this.process = null;
    }.bind(this));
  }
};

module.exports.ChildRunner = ChildRunner;
