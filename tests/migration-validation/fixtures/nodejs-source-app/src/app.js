'use strict';

const express = require('express');
const routes = require('./routes');

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', function (req, res) {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api', routes);

  return app;
}

module.exports = { createApp };
