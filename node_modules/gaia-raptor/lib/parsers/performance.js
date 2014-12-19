var Parser = require('./parser');
var TOKEN = 'Performance Entry: ';

/**
 * Determine whether a log entry is one for performance marks and measures
 * @param {object} item ADB log entry
 * @returns {boolean}
 */
var matcher = function(item) {
  return item.message.indexOf(TOKEN) !== -1;
};

/**
 * Parse an ADB log entry and extract the performance metadata
 * @param {object} item ADB log entry
 * @returns {{
 *   entryType: String,
 *   name: String,
 *   context: String,
 *   startTime: Number,
 *   duration: Number,
 *   epoch: Number,
 *   pid: Number
 * }}
 */
var parser = function(item) {
  var index = item.message.indexOf(TOKEN) + TOKEN.length;
  var parts = item.message
    .substr(index)
    .split('|');
  var name = parts[1].indexOf('@') === -1 ?
    [ parts[1], item.tag ] :
    parts[1].split('@');

  return {
    entryType: parts[0],
    name: name[0],
    context: name[1],
    startTime: parseFloat(parts[2]),
    duration: parseFloat(parts[3]),
    epoch: parseFloat(parts[4]),
    pid: item.pid
  };
};

module.exports = Parser('performanceentry', matcher, parser);