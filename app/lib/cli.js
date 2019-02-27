/**
 * Copyright (c) Camunda Services GmbH.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const mri = require('mri');

const log = require('./log')('app:cli');

/**
 * Parse file arguments from the command line
 * and return them as a list of paths.
 *
 * @param {Array<String>} args
 * @param {String} cwd
 *
 * @return {Object} parsed arguments as { files, flags }
 */
function parse(args, cwd) {

  log.info('parsing %O in %O', args, cwd);

  const {
    _,
    ...flags
  } = mri(args.slice(1));

  const files = _.filter(isPath).map(f => path.resolve(cwd, f)).filter(isFile);

  return {
    files,
    flags
  };
}

module.exports.parse = parse;


function appendArgs(args, additionalArgs) {

  const allArgs = [
    ...args,
    ...additionalArgs
  ];

  const effectiveArgs = allArgs.reduce((effectiveArgs, arg) => {

    if (arg.startsWith('--no-')) {
      delete effectiveArgs[`--${arg.substring(5)}`];
    } else if (!arg.includes('=')) {
      delete effectiveArgs[`--no-${arg.substring(2)}`];
    }

    effectiveArgs[arg] = true;

    return effectiveArgs;
  }, {});

  return Object.keys(effectiveArgs);
}

module.exports.appendArgs = appendArgs;

/**
 * Check a possible filePath represents an existing file.
 *
 * @param {String} filePath
 *
 * @return {Boolean}
 */
function isFile(filePath) {

  try {
    const stats = fs.lstatSync(filePath);

    if (stats.isFile()) {
      return true;
    }

    log.info('skipping directory %s', filePath);
  } catch (e) {
    // file not found or the like...
    log.info(e.message, filePath);
  }

  return false;
}


function isPath(path) {

  if (typeof path !== 'string') {
    log.info('skipping non-file arg %s', path);

    return false;
  }

  return true;
}