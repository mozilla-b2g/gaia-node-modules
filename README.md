# Gaia Node Modules

This repository contains all of the necessary node modules for gaia. By placing them in Github we can reduce failure rates by only relying on a single source for our code.

## Updating gaia-node-modules

1. Create a fork of this repository.
2. Update package.json.
3. Update the node_modules folder by running: ```npm cache clean && npm install --ignore-scripts```
4. Commit *everything*.
5. Submit a pull request, tracked against a bug at: http://bugzilla.mozilla.org.

## Updating Gaia

**Important:** The gaia package.json file also needs to be kept in sync with the package.json in this repository. If the two files are not in sync, the wrong node module versions may be installed.

## Testing on Travis

It's possible to test gaia node modules on travis by forking this repository, and submitting a pull request against gaia pointing to your branch. Here is an example of updating the gaia Makefile to test these changes:

```
--- a/Makefile
+++ b/Makefile
@@ -721,15 +721,15 @@ $(NPM_INSTALLED_PROGRAMS): package.json node_modules
 
 $(NODE_MODULES_SRC):
 ifeq "$(NODE_MODULES_SRC)" "modules.tar"
-       $(DOWNLOAD_CMD) https://github.com/mozilla-b2g/gaia-node-modules/tarball/master
-       mv master "$(NODE_MODULES_SRC)"
+       $(DOWNLOAD_CMD) https://github.com/__YOUR_USER__/gaia-node-modules/tarball/__YOUR_BRANCH_NAME__
+       mv __YOUR_BRANCH_NAME__ "$(NODE_MODULES_SRC)"
 else
        git clone "$(NODE_MODULES_GIT_URL)" "$(NODE_MODULES_SRC)"
 endif
 
 node_modules: $(NODE_MODULES_SRC)
 ifeq "$(NODE_MODULES_SRC)" "modules.tar"
-       $(TAR_WILDCARDS) --strip-components 1 -x -m -f $(NODE_MODULES_SRC) "mozilla-b2g-gaia-node-modules-*/node_modules"
+       $(TAR_WILDCARDS) --strip-components 1 -x -m -f $(NODE_MODULES_SRC) "__YOUR_USER__-gaia-node-modules-*/node_modules"
 else
        mv $(NODE_MODULES_SRC)/node_modules node_modules
 endif
```
