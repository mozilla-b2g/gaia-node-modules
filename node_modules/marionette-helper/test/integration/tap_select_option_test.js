suite('MarionetteHelper.tapSelectOption', function() {

  // Require needed files
  var FakeApp = require('./lib/fake_app');
  marionette.plugin('helper', require('../../index'));
  marionette.plugin('apps', require('marionette-apps'));

  var helper;
  var fakeApp;
  var FAKE_APP_ORIGIN = 'fakeapp.gaiamobile.org';

  var apps = {};
  apps[FAKE_APP_ORIGIN] = __dirname + '/fakeapp';

  var client = marionette.client({
    settings: {
      'ftu.manifestURL': null,
      'lockscreen.enabled': false
    },
    apps: apps
  });

  setup(function(done) {
    helper = client.helper;
    fakeApp = new FakeApp(client, 'app://' + FAKE_APP_ORIGIN);
    fakeApp.launch();
    setTimeout(done, 2500);  // Instead of using the BootWatcher.
  });

  test('should set on option', function() {
    var optionValue = 'option2';
    helper.tapSelectOption('#select', optionValue);
    assert.ok(fakeApp.isSpecificSelectOptionSelected(optionValue));
  });
});
