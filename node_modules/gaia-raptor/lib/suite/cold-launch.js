var Phase = require('./phase');
var Device = require('../device');
var util = require('util');
var path = require('path');
var Promise = require('promise');
var gridItemParser = require('../parsers/griditem');
var performanceParser = require('../parsers/performance');
var memoryParser = require('../parsers/memory');
var debug = require('debug')('raptor:coldlaunch');
var merge = require('deepmerge');
var envParse = require('../parsers/parse-env');

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

  var runner = this;

  this.setManifestData(options.appPath);
  this.registerParser(gridItemParser);
  this.registerParser(performanceParser);
  this.registerParser(memoryParser);
  this.capture('performanceentry');
  this.capture('memoryentry');

  /**
   * To prepare for a test run we need to:
   * 1. Clear the ADB log
   * 2. Restart B2G
   * 3. Prepare the device to accept tap commands
   * 4. Wait for the Homescreen to render the icons so we can capture the
   *    coordinates of the app
   * 5. Swipe down on the Homescreen to account for Flame tapping bugs
   */
  Device.clearLog();

  Device
    .restartB2G()
    .then(function() {
      return runner.prepareForInput();
    })
    .then(function() {
      return runner.waitForHomescreen()
    })
    .then(function(entry) {
      runner.appOnHomescreen = entry;
    })
    .then(function() {
      return runner.swipeHack()
    })
    .then(function() {
      runner.start();
    });
};

util.inherits(ColdLaunch, Phase);

/**
 * Trigger the launch of an application by tapping on the its coordinates on the
 * Homescreen. This will translate the coordinates received from the Homescreen
 * to device pixels.
 * @returns {Promise}
 */
ColdLaunch.prototype.launch = function() {
  var name = this.manifestPath + (this.entryPoint ? '/' + this.entryPoint : '');
  var appOnHomescreen = this.appOnHomescreen;
  var devicePixelRatio = this.deviceInput.devicePixelRatio;

  var x = appOnHomescreen.x;
  var y = appOnHomescreen.y;
  var deviceX = x * devicePixelRatio;
  var deviceY = y * devicePixelRatio;

  debug('[Launching] %s application', name);
  debug('[Launching] Translate to device pixels (X: %d => %d, Y: %d => %d)',
    x, deviceX, y, deviceY);
  debug('[Launching] Triggering device tap on application icon');

  return this.deviceInput.tap(deviceX, deviceY, 1);
};

/**
 * Determine whether a grid item entry is for the application currently being
 * tested
 * @param {object} entry griditem entry object
 * @returns {boolean}
 */
ColdLaunch.prototype.isApplication = function(entry) {
  return entry.url.indexOf(this.manifestPath) !== -1 &&
    entry.entryPoint === this.entryPoint;
};

/**
 * Resolve when the Homescreen receives a grid item matching the application
 * currently being tested
 * @returns {Promise}
 */
ColdLaunch.prototype.waitForHomescreen = function() {
  var runner = this;

  return new Promise(function(resolve) {
    // We need to clear the log before waiting for entries otherwise previous
    // grid items entries from runs or otherwise could be captured
    Device
      .clearLog()
      .then(function() {
        debug('Waiting for homescreen');

        runner.dispatcher.on('griditem', function listener(entry) {
          if (!runner.isApplication(entry)) {
            return;
          }

          runner.dispatcher.removeListener('griditem', listener);
          resolve(entry);
        });
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
      // Throw away performance entries that don't match the application we are
      // testing
      if (entry.context !== runner.manifest.name) {
        return;
      }

      debug('Received performance entry `%s`', entry.name);

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
      runner.appOnHomescreen.pid = entry.pid;
      Device.logMemory(runner.manifest.name, entry.context);
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
  if (!this.appOnHomescreen || !this.appOnHomescreen.pid) {
    return Promise.resolve(null);
  }

  return Device.closeApp(this.appOnHomescreen.pid);
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
 * For a given result entry, create a reportable object which represents a point
 * of memory data. Captures any environment metadata supplied for persistence.
 * @param {object} entry result entry
 * @returns {object}
 */
ColdLaunch.prototype.createMemoryPoint = function(entry) {
  return merge({
    name: entry.name,
    time: this.time,
    uss: entry.uss,
    pss: entry.pss,
    rss: entry.rss
  }, envParse());
};

/**
 * For a given result entry, create a reportable object which represents a point
 * of a performance marker or measure. Captures any environment metadata
 * supplied for persistence.
 * @param {object} entry
 * @param {object} launch result entry which marked the launch time of the app
 * @returns {object}
 */
ColdLaunch.prototype.createPoint = function(entry, launch) {
  return merge({
    name: entry.name,
    time: this.time,
    epoch: entry.epoch,
    value: entry.entryType === 'mark' ?
      entry.epoch - launch.epoch :
      entry.duration
  }, envParse());
};

/**
 * Write the given entries to a format suitable for reporting
 * @param {Array} entries
 * @returns {object}
 */
ColdLaunch.prototype.format = function(entries) {
  var runner = this;
  var appLaunch = entries.filter(function(entry) {
    return entry.name === 'appLaunch';
  })[0];

  var results = {};

  entries.forEach(function(entry) {
    if (entry.context !== runner.manifest.name) {
      return;
    }

    if (entry.name === 'appLaunch') {
      return;
    }

    var name = entry.name;
    var context = runner.appName;
    var seriesFormat = 'Suites.%s.%s.%s';
    var series, point;

    if (name === 'fullyLoadedMemory') {
      series = util.format(seriesFormat, 'Memory', context, name);
      point = runner.createMemoryPoint(entry);
    } else {
      series = util.format(seriesFormat, 'ColdLaunch', context, name);
      point = runner.createPoint(entry, appLaunch);
    }

    if (!results[series]) {
      results[series] = [];
    }

    results[series].push(point);
  });

  return results;
};

/**
 * Report the results for an individual test run
 * @returns {Promise}
 */
ColdLaunch.prototype.handleRun = function() {
  var results = this.format(this.results);
  return this.report(results);
};

module.exports = ColdLaunch;