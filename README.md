# Gaia Node Modules

This repository contains all of the necessary node modules for gaia. By placing them in Github we can reduce failure rates by only relying on a single source for our code.

## Updating gaia-node-modules

1. Create a fork of this repository.
2. Update package.json.
3. Update the node_modules folder by running: ```npm cache clean && npm install --ignore-scripts```
4. Commit *everything*.
5. Submit a pull request, tracked against a bug at: http://bugzilla.mozilla.org.

### A note about our mocha fork

After significant waiting in https://bugzil.la/986206 we decided to fork
mocha npm since the patch we upstreamed hadn't been published to npm.
Forking modules in npm is a weird business because of naming collisions
and no support for "aliasing". Therefore we did something very weird and
fetched https://www.npmjs.org/package/mocha-gaia and renamed it
locally... ::cringe::
