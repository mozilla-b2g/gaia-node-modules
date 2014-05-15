var waitForApp = require('./waitforapp').waitForApp;
var getApp = require('./getapp').getApp;

var url = require('url');
var fsPath = require('path');

/**
 * Launch an application based on its origin and optionally entrypoint.
 * Will wait until app's iframe is visible before firing callback.
 *
 *    launch(apps, 'app://calendar.gaiamobile.org', function(err, app) {
 *      // yey
 *    });
 *
 * @param {Apps} apps instance.
 * @param {String} origin of the app.
 * @param {String} [entrypoint] for the app.
 * @param {Function} callback [Error err, App app].
 */
function launch(apps, origin, entrypoint, callback) {
  if (typeof entrypoint === 'function') {
    callback = entrypoint;
    entrypoint = null;
  }

  callback = callback || apps._client.defaultCallback;

  // Wait for Homescreen app is rendered.
  var client = apps._client.scope({ searchTimeout: 10000 });
  client.waitFor(function() {
    var el = client.findElement('iframe[src*="homescreen.gaiamobile.org"]');
    var frameClass = el.scriptWith(function(el) {
      return el.parentNode.getAttribute('class');
    });

    if (frameClass !== null) {
      return frameClass.indexOf('render') !== -1;
    } else {
      return el.displayed();
    }
  });

  // launch the given app
  return getApp(apps, origin, entrypoint, function(err, app) {
    if (err) {
      return callback(err);
    }

    // if a null entrypoint is given it is safely ignored.
    app.launch(entrypoint);

    // wait for this app to be visible
    return waitForApp(apps, app.source, function(err, element) {
      return callback(err, app, element);
    });
  });
}

module.exports.launch = launch;
