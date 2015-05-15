#! /usr/bin/env node

// This module is the entrypoint so it needs to import the polyfill...
import '6to5/polyfill';

import { ArgumentParser } from 'argparse';
import assert from 'assert';
import Debug from 'debug';
import npm from '../npm';
import taskcluster from 'taskcluster-client';
import request from 'superagent-promise';
import fs from 'mz/fs';
import fsPath from 'path';
import eventToPromise from 'event-to-promise';
import hash from '../hash';
import signature from '../signature';

let debug = new Debug('npm-cache:put');
let parser = new ArgumentParser();
parser.addArgument(['--task-id'], {
  help: 'The task to run caching logic for',
  required: true,
  dest: 'taskId'
});

parser.addArgument(['--run-id'], {
  help: 'Run id for the particular task',
  dest: 'runId',
  defaultValue: 0
});

parser.addArgument(['--namespace'], {
  defaultValue: 'npm_cache',
  help: 'Index namespace to use'
});

parser.addArgument(['--proxy'], {
  action: 'storeTrue',
  help: 'Rely on the taskcluster proxy service provided by the docker-worker'
});

async function upload(queue, taskId, runId, expires, modulePath) {
  let size = (await fs.stat(modulePath)).size;
  let tar = fs.createReadStream(modulePath);

  let artifact = {
    storageType: 's3',
    expires: expires,
    contentType: 'application/x-tar'
  };

  let artifactUrl = await queue.createArtifact(
    taskId, runId, 'public/node_modules.tar.gz', artifact
  );

  let put = request.put(artifactUrl.putUrl);
  put.set('Content-Length', size);
  put.set('Content-Type', 'application/x-tar');
  put.set('Content-Encoding', 'gzip');
  tar.pipe(put);
  put.end()
  await eventToPromise(put, 'end');
}

async function main() {
  let args = parser.parseArgs(process.argv.slice(2));

  let queueOpts = {};
  let indexOpts = {};

  if (args.proxy) {
    queueOpts.baseUrl = 'taskcluster/queue/v1';
    indexOpts.baseUrl = 'taskcluster/index/v1';
  }

  let queue = new taskcluster.Queue(queueOpts);
  let index = new taskcluster.Index(indexOpts);

  let task = await queue.getTask(args.taskId);

  if (!task.extra || !task.extra.npmCache) {
    console.error('Task must contain task.extra');
    process.exit(1);
  }

  let url = task.extra.npmCache.url;
  if (!url) {
    console.error('Task must contain a extra.npmCache.url');
    process.exit(1);
  }

  let expires = new Date(task.extra.npmCache.expires);
  if (!task.extra.npmCache.expires || expires < new Date()) {
    console.error(
      'Task must contain extra.npmCache.expires and be in the future.'
    );
    process.exit(1);
  }

  let pkgReqs = await request.get(url).end();
  let pkg = JSON.parse(pkgReqs.text.trim());
  let pkgHash = hash(pkgReqs.text.trim());
  let namespace = `${args.namespace}.${signature()}.${pkgHash}`

  debug('Package hash =', pkgHash);
  debug('Package namespace =', namespace);

  // Check to see if we already have this package json cached...
  try {
    let indexedTask = await index.findTask(namespace);
    debug('Cache hit. Skipping tarball creation.');
    process.exit(0);
  } catch (e) {
    if (!err.statusCode || err.statusCode !== 404) throw e;
  }

  let workspace = await npm();
  await workspace.install(pkg);
  let moduleTar = await workspace.exportTar()
  await upload(queue, args.taskId, args.runId, expires, moduleTar);

  let indexPayload = {
    taskId: args.taskId,
    rank: 0, // XXX: How should we define ranking?
    expires: expires,
    data: {}
  };

  // Insert the platform specific index namespace...
  await index.insertTask(namespace, indexPayload);
}

main().catch((e) => {
  process.nextTick(() => {
    console.error('Something is wrong...');
    throw e;
  })
});
