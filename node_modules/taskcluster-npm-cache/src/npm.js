import temp from 'promised-temp';
import del from 'delete';
import denodeify from 'denodeify';
import eventToPromise from 'event-to-promise';
import Debug from 'debug';
import run from './run';
import { format } from 'util';
import fs from 'mz/fs';
import fsPath from 'path';

import download from 'download';
import downloadStatus from 'download-status';

let debug = Debug('npm-cache:workspace');

class Workspace {
  constructor(dir) {
    this.dir = dir;
  }

  /**
  Destroy all temporary assets created.
  */
  async destroy() {
    await denodeify(del)(this.dir, { force: true });
  }

  /**
  Extract package from remote target into given directory.
  */
  async extract(url, target) {
    debug('extract', { url, target });
    let path = fsPath.join(target, 'node_modules.tar.gz');

    let req = download().
      get(url).
      dest(target).
      use(downloadStatus())

    await denodeify(req.run).call(req);

    // XXXAus: We should get rid of this in favor of a platform agnostic
    //         module.
    await run('tar', ['zxf', path], { cwd: target });
  }

  /**
  Update or install node modules associated with the package json URL
  provided.
  */
  async install(pkg) {
    let pkgPath = fsPath.join(this.dir, 'package.json');

    if (await fs.exists(pkgPath)) {
      throw new Error('Cannot run install twice (package.json exists)');
    }

    await fs.writeFile(pkgPath, JSON.stringify(pkg));

    // XXX: We may want to sanitize parts of this such as scripts which
    //      effectively lets you run untrusted code.
    await run('npm', ['install'], {
      cwd: this.dir
    });
  }

  /**
  Create a new tar containing node_modules and return path.
  */
  async exportTar() {
    let modulesPath = fsPath.join(this.dir, 'node_modules');
    if (!await fs.exists(modulesPath)) {
      throw new Error('No modules to export (node_modules missing)');
    }

    let exportPath = fsPath.join(this.dir, 'node_modules.tar.gz')

    // XXXAus: We should get rid of this in favor of a platform agnostic
    //         module.
    await run('tar', ['czf', exportPath, 'node_modules'], {
      cwd: this.dir
    });

    return exportPath;
  }
}

/**
Initialize the workspace with a temp directory.
*/
export default async function init() {
  let dir = await temp.mkdir('npm-cache');
  debug('create: %s', dir);
  return new Workspace(dir);
}
