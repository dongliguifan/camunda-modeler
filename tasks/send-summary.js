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

const exec = require('execa').sync;

const nodemailer = require('nodemailer');

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
  const version = getVersion();
  const summary = await getSummary();

  const message = getMessageBody(summary, version);

  console.log(`Sending summary for version ${version}`);
  console.log(message);

  await sendEmail(`Camunda Modeler ${version} Third Party Summary`, message);
}

function getVersion() {
  return exec('git', [
    'describe',
    '--abbrev=0'
  ]).stdout;
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

function sendEmail(subject, body) {

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

  return transport.sendMail(message);
}
