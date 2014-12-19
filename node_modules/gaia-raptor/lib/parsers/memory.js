var Parser = require('./parser');
var TOKEN = 'Memory Entry: ';

/**
 * Determine whether a log entry is one for an application's memory entry
 * @param {object} item ADB log entry
 * @returns {boolean}
 */
var matcher = function(item) {
  return item.message.indexOf(TOKEN) !== -1;
};

/**
 * Parse an ADB log entry and extract the application's memory information, i.e.
 * USS, PSS, and RSS
 * @param {object} item ADB log entry
 * @returns {{context: String, name: String, uss: Number, pss: Number, rss: Number}}
 */
var parser = function(item) {
  var index = item.message.indexOf(TOKEN) + TOKEN.length;
  var parts = item.message
    .substr(index)
    .split('|');
  var context = parts[0];
  var memoryParts = parts[1]
    .replace(context, '')
    .split(/\s+/g);

  return {
    context: context,
    name: 'fullyLoadedMemory',
    uss: parseFloat(memoryParts[5]),
    pss: parseFloat(memoryParts[6]),
    rss: parseFloat(memoryParts[7])
  };
};


module.exports = Parser('memoryentry', matcher, parser);