var fsPath = require('path');

module.exports = function requireResovle(path) {
  try {
    return require(path);
  } catch (e) {
    // require + resolve to current cwd if relative path.
    return require(fsPath.resolve(path));
  }
};
