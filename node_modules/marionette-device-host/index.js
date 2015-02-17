var Host = require('./host');

var restart = ('RESTART_B2G' in process.env) ?
  parseInt(process.env.RESTART_B2G) : 1;

exports.help = {
  group: {
    title: 'Device Host',
    description: 'Device host uses adb to enable marionette on device.'
  },

  arguments: {
    '--port': {
      defaultValue: 2828,
      dest: 'port',
      help: 'Port to use for adb forwarding.',
      type: 'int'
    },

    '--restart': {
      defaultValue: restart,
      dest: 'restart',
      help: 'Whether or not to restart device on start.',
      type: 'int',
    }
  }
};

exports.createHost = Host.createHost;
exports.createSession = Host.createSession;
