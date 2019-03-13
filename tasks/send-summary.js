/**
 * Copyright Camunda Services GmbH and/or licensed to Camunda Services GmbH
 * under one or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information regarding copyright
 * ownership.
 *
 * Camunda licenses this file to you under the MIT; you may not use this file
 * except in compliance with the MIT License.
 */

'use strict';

const fs = require('fs');

const path = require('path');

const exec = require('execa').sync;

const nodemailer = require('nodemailer');

const { Diff2Html: diff2html } = require('diff2html');


const {
  collectClientDependencies,
  collectLicenses,
  generateSummary,
  processLicenses
} = require('./license-book-handlers');

sendSummary().then(
  () => console.log('Done.'),
  (err) => {
    console.error(err);

    process.exit(1);
  }
);

async function sendSummary() {
  const { previousVersion, currentVersion } = getVersions();

  console.log(`Sending summary for version ${currentVersion}`);

  console.log('Generating summary...');

  const summary = await getSummary();

  let message = getMessageBody(summary, currentVersion);

  console.log('Generating diff...');

  const diff = getDiff({
    currentVersion,
    previousVersion,
    file: './THIRD_PARTY_NOTICES'
  });

  let html;

  if (diff) {
    html = getHtmlFromDiff(diff);
    console.log('Diff generated');

    message += '\n\nChanges since last version can be found in the attachment.';
  } else {
    console.log('Diff could not be generated');
  }

  console.log('Sending email...');


  await sendEmail(`Camunda Modeler ${currentVersion} Third Party Summary`, message, html);
}

function getVersions() {
  const currentVersion = exec('git', [
    'describe',
    '--abbrev=0'
  ]).stdout;

  const previousVersion = exec('git', [
    'describe',
    '--abbrev=0',
    `${currentVersion}^`
  ]).stdout;

  return {
    currentVersion,
    previousVersion
  };
}

async function getSummary() {
  const clientDependencies = collectClientDependencies();

  const combinedLicenses = await collectLicenses(
    { name: 'app' },
    { name: 'client', filter: name => clientDependencies[name] }
  );

  const {
    processedLicenses
  } = processLicenses(combinedLicenses);

  return generateSummary(processedLicenses);
}

function getMessageBody(summary, version) {
  return `${summary}

Third party notices: https://github.com/camunda/camunda-modeler/blob/${version}/THIRD_PARTY_NOTICES
  `;
}

function getDiff({ currentVersion, previousVersion, file }) {
  let diff;

  try {
    const previousFile = exec('git', ['show', `${previousVersion}:${file}`]).stdout;

    // const diff = shell(`diff -c - ${path.join(process.cwd(), file)}`, { input: previousFile }).then(console.log).catch(() => console.error('demn'));

    diff = exec('diff', ['-u', '-', `${path.join(process.cwd(), file)}`], { input: previousFile });

    return diff;
  } catch (error) {
    diff = error.stdout;
  }

  return diff || null;
}

function getHtmlFromDiff(diff) {
  const style = fs.readFileSync(require.resolve('diff2html/dist/diff2html.min.css'));

  const diffHtml = diff2html.getPrettyHtml(diff, { inputFormat: 'diff', showFiles: true, matching: 'lines', outputFormat: 'side-by-side' });

  const html = `
  <style>${style}</style>
  ${diffHtml}
  `;

  return html;
}

function sendEmail(subject, body, attachment) {

  const {
    EMAIL_HOST: host,
    EMAIL_USERNAME: username,
    EMAIL_PASSWORD: password,
    EMAIL_RECIPIENT: recipient
  } = process.env;

  const transport = nodemailer.createTransport({
    host,
    secure: true,
    auth: {
      user: username,
      pass: password
    }
  });

  const message = {
    to: recipient,
    subject,
    text: body,
  };

  if (attachment) {
    message.attachments = [
      {
        filename: 'changes_summary.html',
        content: attachment
      }
    ];
  }

  return transport.sendMail(message);
}
