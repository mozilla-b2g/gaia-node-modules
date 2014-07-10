var fsPath = require('path'),
    fs = require('fs'),
    corredor = require('corredor-js'),
    debug = require('debug')('marionette-socket-host');

var DEFAULT_LOCATION = fsPath.join(process.cwd(), 'b2g');

/**
 * Host interface for marionette-js-runner.
 *
 * @param {Object} [options] for host that get forwarded over the socket.
 */
function Host(options) {
  // TODO: host api should have some concept of a "asset" directory
  //       where we can stuff b2g-desktop without saving it in node_modules or
  //       cwd.
  this.options = options || {};
  this.options.runtime = this.options.runtime || DEFAULT_LOCATION;

  this.address = 'ipc:///tmp/marionette_socket_host_worker';
  this.runner = null;
}

/**
 * Immutable metadata describing this host.
 *
 * @type {Object}
 */
Host.metadata = Object.freeze({
  host: 'socket'
});

Host.prototype = {
  /**
   * Starts the b2g-desktop process.
   *
   * @param {String} profile path.
   * @param {Object} [options] settings provided by caller.
   * @param {Function} callback [Error err].
   */
  start: function(profile, options, callback) {
    debug('start called with: ', profile, options);
    if (typeof options === 'function') {
      callback = options;
      options = null;
    }

    var userOptions = {};

    for (var key in options) {
      userOptions[key] = options[key];
    }
    userOptions.profile = userOptions.profile || profile;
    userOptions.product = userOptions.product || 'b2g';
    userOptions.runtime = this.options.customRuntime;
    userOptions.chrome = 'chrome://b2g/content/shell.html';

    var self = this;
    var target = userOptions.runtime || self.options.runtime;

    function done(data) {
      debug('received ready_start, application should be running');
      callback();
    }

    // Create and destroy a new socket each time, otherwise the socket
    // remains open after suite_end and causes a timeout when a second
    // Host attempts to connect, see bug 994888.
    this.runner =  new corredor.ExclusivePair();
    this.runner.connect(this.address);
    this.runner.registerAction('ready_start', done);
    this.runner.send({action: 'start_runner',
                      target: target,
                      options: userOptions });
  },

  /**
   * Stop the currently running host.
   *
   * @param {Function} callback [Error err].
   */
  stop: function(callback) {
    debug('stop called');
    var self = this;
    function done(data) {
      debug('received ready_stop, application should be stopped');
      self.runner.close();
      callback();
    }
    this.runner.registerAction('ready_stop', done);
    this.runner.send({action: 'stop_runner'});
  },
};

module.exports = Host;
