function Host(options) {
  this.options = options;
}

Host.metadata = {};

Host.help = {
  group: {
    title: 'CUSTOM XFOO',
    description: 'CUSTOM DESC'
  },

  arguments: {
    '--code': {
      type: 'int',
      help: 'exit code'
    }
  }
};

Host.prototype = {
  start: function(callback) {
    // magic process exit number to indicate that this file was loaded.
    process.exit(this.options.code);
  }
};

module.exports = Host;
