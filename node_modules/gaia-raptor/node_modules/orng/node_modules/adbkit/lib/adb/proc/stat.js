(function() {
  var EventEmitter, ProcStat, split,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require('events').EventEmitter;

  split = require('split');

  ProcStat = (function(_super) {
    var RE_COLSEP, RE_CPU;

    __extends(ProcStat, _super);

    RE_COLSEP = /\ +/g;

    RE_CPU = /^cpu[0-9]+$/;

    function ProcStat(sync) {
      this.sync = sync;
      this.interval = 1000;
      this.stats = this._emptyStats();
      this._ignore = {};
      this._timer = setInterval((function(_this) {
        return function() {
          return _this.update();
        };
      })(this), this.interval);
      this.update();
    }

    ProcStat.prototype.end = function() {
      clearInterval(this._timer);
      this.sync.end();
      return this.sync = null;
    };

    ProcStat.prototype.update = function() {
      return this.sync.pull('/proc/stat', (function(_this) {
        return function(err, stream) {
          if (err) {
            return _this._error(err);
          }
          return _this._parse(stream);
        };
      })(this));
    };

    ProcStat.prototype._parse = function(stream) {
      var lines, stats;
      stats = this._emptyStats();
      lines = stream.pipe(split());
      lines.on('data', (function(_this) {
        return function(line) {
          var cols, total, type, val, _i, _len;
          cols = line.split(RE_COLSEP);
          type = cols.shift();
          if (_this._ignore[type] === line) {
            return;
          }
          if (RE_CPU.test(type)) {
            total = 0;
            for (_i = 0, _len = cols.length; _i < _len; _i++) {
              val = cols[_i];
              total += +val;
            }
            return stats.cpus[type] = {
              line: line,
              user: +cols[0] || 0,
              nice: +cols[1] || 0,
              system: +cols[2] || 0,
              idle: +cols[3] || 0,
              iowait: +cols[4] || 0,
              irq: +cols[5] || 0,
              softirq: +cols[6] || 0,
              steal: +cols[7] || 0,
              guest: +cols[8] || 0,
              guestnice: +cols[9] || 0,
              total: total
            };
          }
        };
      })(this));
      return lines.on('end', (function(_this) {
        return function() {
          return _this._set(stats);
        };
      })(this));
    };

    ProcStat.prototype._set = function(stats) {
      var cur, found, id, loads, m, old, ticks, _ref;
      loads = {};
      found = false;
      _ref = stats.cpus;
      for (id in _ref) {
        cur = _ref[id];
        old = this.stats.cpus[id];
        if (!old) {
          continue;
        }
        ticks = cur.total - old.total;
        if (ticks > 0) {
          found = true;
          m = 100 / ticks;
          loads[id] = {
            user: Math.floor(m * (cur.user - old.user)),
            nice: Math.floor(m * (cur.nice - old.nice)),
            system: Math.floor(m * (cur.system - old.system)),
            idle: Math.floor(m * (cur.idle - old.idle)),
            iowait: Math.floor(m * (cur.iowait - old.iowait)),
            irq: Math.floor(m * (cur.irq - old.irq)),
            softirq: Math.floor(m * (cur.softirq - old.softirq)),
            steal: Math.floor(m * (cur.steal - old.steal)),
            guest: Math.floor(m * (cur.guest - old.guest)),
            guestnice: Math.floor(m * (cur.guestnice - old.guestnice)),
            total: 100
          };
        } else {
          this._ignore[id] = cur.line;
          delete stats.cpus[id];
        }
      }
      if (found) {
        this.emit('load', loads);
      }
      return this.stats = stats;
    };

    ProcStat.prototype._error = function(err) {
      return this.emit('error', err);
    };

    ProcStat.prototype._emptyStats = function() {
      return {
        cpus: {}
      };
    };

    return ProcStat;

  })(EventEmitter);

  module.exports = ProcStat;

}).call(this);
