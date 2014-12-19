var Phase = require('./phase');
var Promise = require('promise');
var util = require('util');

/**
 * Create a suite runner which achieves a ready state when an application is
 * warm-launched, e.g. reopened after being backgrounded
 * @param {{}} options
 * @constructor
 */
var WarmLaunch = function(options) {
  Phase.call(this, options);

  this.start();
};

util.inherits(WarmLaunch, Phase);

/**
 * Stand up an application warm launch for each individual test run.
 */
WarmLaunch.prototype.testRun = function() {
  throw new Error('Not implemented');
};

/**
 * Retry handler which is invoked if a test run fails to complete.
 */
WarmLaunch.prototype.retry = function() {
  throw new Error('Not implemented');
};

/**
 * Functionality to execute after each run, e.g. reporting results
 */
WarmLaunch.prototype.handleRun = function() {
  throw new Error('Not implemented');
};

module.exports = WarmLaunch;