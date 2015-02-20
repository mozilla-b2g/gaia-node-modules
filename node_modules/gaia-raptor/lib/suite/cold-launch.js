var Phase = require('./phase');
var util = require('util');
var path = require('path');
var Promise = require('promise');
var performanceParser = require('../parsers/performance');
var memoryParser = require('../parsers/memory');
var debug = require('debug')('raptor:coldlaunch');
var homescreenConfig = require('../../dist/homescreens.json');

// These are derived from GAIA/shared/elements/gaia_grid/js/grid_layout.js
var GAIA_MIN_ICONS_PER_ROW = 3;
var GAIA_MIN_ROW_HEIGHT_FACTOR = 3.8;
var GAIA_MAX_ROW_HEIGHT_FACTOR = 5;
var VERTICAL_CONTEXT = 'verticalhome.gaiamobile.org';

/**
 * Create a suite runner which achieves a ready state when an application is
 * cold-launched, e.g. from a new process
 * @param {{
 *   appPath: String,
 *   runs: Number,
 *   timeout: Number,
 *   retries: Number
 * }} options
 * @constructor
 */
var ColdLaunch = function(options) {
  Phase.call(this, options);

  this.swipeHackDelay = this.options.emulator ? 6 * 1000 : 3 * 1000;
  var runner = this;

  /**
   * To prepare for a test run we need to:
   * 1. Clear the ADB log
   * 2. Restart B2G
   * 3. Pre-fetch the application's coordinates
   * 4. Wait for the Homescreen to load so we know when to be able to launch
   * 5. Swipe down on the Homescreen to account for Flame tapping bugs
   */

  this.getDevice()
    .then(function() {
      runner.setManifestData(options.appPath);
      runner.registerParser(performanceParser);
      runner.registerParser(memoryParser);
      runner.capture('performanceentry');
      runner.capture('memoryentry');
    })
    .then(function() {
      return runner.device.log.clear();
    })
    .then(function() {
      return runner.device.util.restartB2G();
    })
    .then(function() {
      return runner.setCoordinates();
    })
    .then(function() {
      return runner.waitForHomescreen();
    })
    .then(function() {
      return runner.prime();
    })
    .then(function() {
      runner.start();
    });
};

util.inherits(ColdLaunch, Phase);

/**
 * Set the coordinates of the Homescreen location for the application to launch.
 * This will translate the coordinates to device pixels.
 */
ColdLaunch.prototype.setCoordinates = function() {
  var manifestPath = this.manifestPath;
  var entryPoint = this.entryPoint;

  var columns = homescreenConfig.preferences['grid.cols'];
  var deviceWidth = this.device.config.dimensions[0];
  var devicePixelRatio = this.device.pixelRatio;
  var gridOrigin = this.GRID_ORIGIN_Y * devicePixelRatio;
  var columnWidth = deviceWidth / columns;
  var rowHeightFactor = columns === GAIA_MIN_ICONS_PER_ROW ?
    GAIA_MIN_ROW_HEIGHT_FACTOR : GAIA_MAX_ROW_HEIGHT_FACTOR;
  var rowHeight = (deviceWidth / rowHeightFactor) * devicePixelRatio;
  var ordinalX = columnWidth / 2;
  var ordinalY = gridOrigin + rowHeight / 2;
  var appIndex = null;

  // Walk through the config apps until we find one matching the current app
  homescreenConfig.homescreens[0]
    .every(function(app, index) {
      if (manifestPath === app[1]) {
        if (entryPoint) {
          if (entryPoint === app[2]) {
            appIndex = index;
            return false;
          }
        } else {
          appIndex = index;
          return false;
        }
      }

      return true;
    });

  if (appIndex === null) {
    return this.emit('error',
      new Error('Unable to find configured application on Homescreen'));
  }

  var row = Math.floor(appIndex / columns);
  var column = appIndex % columns;

  this.appX = ordinalX + columnWidth * column;
  this.appY = ordinalY + rowHeight * row;
};

/**
 * Trigger the launch of an application by tapping at its coordinates on the
 * Homescreen.
 * @returns {Promise}
 */
ColdLaunch.prototype.launch = function() {
  return this.device.input.tap(this.appX, this.appY, 1);
};

/**
 * Resolve when the Homescreen has been fully loaded
 * @returns {Promise}
 */
ColdLaunch.prototype.waitForHomescreen = function() {
  var runner = this;

  return new Promise(function(resolve) {
    debug('Waiting for homescreen');

    runner.dispatcher.on('performanceentry', function listener(entry) {
      debug('Received performance entry `%s` in %s', entry.name, entry.context);

      if (entry.context !== VERTICAL_CONTEXT || entry.name !== 'fullyLoaded') {
        return;
      }

      if (!runner.homescreenPid) {
        debug('Capturing Homescreen PID: %d', entry.pid);
        runner.homescreenPid = entry.pid;
      }

      runner.dispatcher.removeListener('performanceentry', listener);
      resolve();
    });
  });
};

/**
 * From a given <appPath> generate any necessary manifest metadata, e.g.
 * entry point, application name, and other manifest data
 * @param appPath
 */
ColdLaunch.prototype.setManifestData = function(appPath) {
  var parts = appPath.split('/');

  this.manifestPath = parts[0];
  this.entryPoint = parts[1] || '';
  this.manifestURL = this.manifestPath + '.gaiamobile.org';
  this.manifest = this.requireManifest(path.join(
    process.cwd(), 'apps', this.manifestPath, 'manifest.webapp'));
  this.appName = this.entryPoint ?
    this.manifest.entry_points[this.entryPoint].name :
    this.manifest.name;
};

/**
 * Resolve when the launched application has created a performance marker
 * denoting `fullyLoaded`
 * @returns {Promise}
 */
ColdLaunch.prototype.waitForFullyLoaded = function() {
  var runner = this;
  var dispatcher = this.dispatcher;

  return new Promise(function(resolve) {
    dispatcher.on('performanceentry', function handler(entry) {
      debug('Received performance entry `%s` in %s', entry.name, entry.context);

      // Throw away performance entries that don't match the application we are
      // testing
      if (entry.context !== runner.manifestURL) {
        return;
      }

      if (!runner.appPid && entry.pid !== runner.homescreenPid) {
        debug('Capturing application PID: %d', entry.pid);
        runner.appPid = entry.pid;
      }

      if (entry.name !== 'fullyLoaded') {
        return;
      }

      dispatcher.removeListener('performanceentry', handler);
      resolve(entry);
    });
  });
};

/**
 * Resolve when a memory entry has been received for the launched application
 * @returns {Promise}
 */
ColdLaunch.prototype.waitForMemoryEntry = function() {
  var dispatcher = this.dispatcher;

  return new Promise(function(resolve) {
    dispatcher.once('memoryentry', function(entry) {
      if (entry && entry.uss) {
        debug('Received memory entry USS:%d | PSS:%d | RSS:%s',
          entry.uss, entry.pss, entry.rss);
      }

      resolve();
    });
  });
};

/**
 * Prime application for cold-launch by starting the application and closing it,
 * causing it to do any introductory operations e.g. DB, IO, etc.
 * @returns {Promise}
 */
ColdLaunch.prototype.prime = function() {
  var runner = this;

  debug('Priming %s cold-launch', this.appName);

  // Wait for 6 seconds to give time for pre-allocated process
  setTimeout(function() {
    return runner
      .swipeHack()
      .then(function() {
        setTimeout(function() {
          runner.launch();
        }, runner.swipeHackDelay);
      });
  }, 6000);

  return this
    .waitForFullyLoaded()
    .then(function() {
      return runner.closeApp();
    });
};

/**
 * Stand up an application cold launch for each individual test run. Will denote
 * the run has completed its work when the application is fully loaded and its
 * memory captured
 * @returns {Promise}
 */
ColdLaunch.prototype.testRun = function() {
  var runner = this;

  this
    .waitForFullyLoaded()
    .then(function(entry) {
      runner.device.log.memory(runner.manifest.name, entry.context);
    });

  // Wait for 6 seconds to give time for pre-allocated process
  setTimeout(function() {
    runner.launch();
  }, 6000);

  return this.waitForMemoryEntry();
};

/**
 * Close the currently launched application if one is opened
 * @returns {Promise}
 */
ColdLaunch.prototype.closeApp = function() {
  if (!this.appPid) {
    return Promise.resolve(null);
  }

  var runner = this;

  return this.device.util
    .kill(this.appPid)
    .then(function() {
      runner.appPid = null;
    });
};

/**
 * Retry handler which is invoked if a test run fails to complete. Attempts to
 * close the contextual application and do a Homescreen swipe to reinitialize
 * tap capability on a Flame.
 * @returns {Promise}
 */
ColdLaunch.prototype.retry = function() {
  var runner = this;

  return this
    .closeApp()
    .then(function() {
      return runner.swipeHack();
    });
};

/**
 * Report the results for an individual test run
 * @returns {Promise}
 */
ColdLaunch.prototype.handleRun = function() {
  var manifestURL = this.manifestURL;

  var results = this.format(this.results.filter(function(entry) {
    return entry.context === manifestURL;
  }), 'ColdLaunch', 'appLaunch');

  return this.report(results);
};

module.exports = ColdLaunch;