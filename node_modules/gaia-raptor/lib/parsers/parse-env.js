var changeCase = require('change-case');
var TOKEN = 'RAPTOR_DATA_';

/**
 * Determine whether an environment key is for RAPTOR DATA
 * @param {string} item environment variable key
 * @returns {boolean}
 */
var matcher = function(item) {
  return item.indexOf(TOKEN) !== 0;
};

/**
 * Convert an environment variable key for RATPOR DATA into a camel case name
 * @param {string} item environment variable key
 * @returns {string}
 */
var parser = function(item) {
  return changeCase.camel(item.replace(TOKEN, ''));
};

/**
 * Capture and format all RAPTOR DATA from the environment variables suitable
 * for JSON representation
 * @returns {object}
 */
module.exports = function() {
  var data = {};

  Object
    .keys(process.env)
    .forEach(function(key) {
      if (!matcher(key)) {
        return;
      }

      data[parser(key)] = process.env[key];
    });

  return data;
};