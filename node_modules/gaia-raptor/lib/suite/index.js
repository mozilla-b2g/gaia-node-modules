var runners = {
  'cold': 'cold-launch',
  'reboot': 'reboot',
  'restart-b2g': 'restart-b2g',
  'first-time': 'first-time-launch',
  'warm': 'warm-launch'
};

/**
 * Factory to instantiate a suite runner based on the phase type, e.g. `cold`,
 * `reboot`, `first`, `warm`
 * @param {{
 *   phase: String
 * }} options
 * @returns {Runner}
 * @constructor
 */
var Suite = function(options) {
  var name = runners[options.phase];
  var Runner = require('./' + name);
  var runner = new Runner(options);

  return runner;
};

module.exports = Suite;