# Gaia Node Modules

This repository contains all of the necessary node modules for gaia. By placing them in Github we can reduce failure rates by only relying on a single source for our code.

## Updating gaia-node-modules

1. Create a fork of this repository.
2. Update package.json.
3. Update the node_modules folder by running: ```npm cache clean && npm install --ignore-scripts```
4. Commit *everything*.
5. Submit a pull request, tracked against a bug at: http://bugzilla.mozilla.org.  You don't need a special bug just for this change; you can reuse whatever bug is trying to fix the underlying problem.

## Updating gaia

1. After the gaia-node-modules pull request lands, update the gaia_node_modules.revision file in gaia to reference the new revision.
2. Also update the package.json in gaia so they don't get out-of-sync.
3. Submit a pull request, again tracked against a bug at: http://bugzilla.mozilla.org.
