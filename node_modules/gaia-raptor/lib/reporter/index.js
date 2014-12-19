var debug = require('debug')('raptor:reporter');

/**
 * Report time-series data to a file or database determined from the environment
 * @param {object} data
 * @returns {Promise}
 */
module.exports = function(data) {
  var reporter = process.env.RAPTOR_DATABASE ? 'database' : 'file';
  var report = require('./' + reporter);

  debug('Using %s method to report', reporter);
  return report(data);
};