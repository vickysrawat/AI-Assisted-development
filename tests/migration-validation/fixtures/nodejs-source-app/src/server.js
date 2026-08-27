'use strict';

const { createApp } = require('./app');

const PORT = Number(process.env.PORT || 3000);

const app = createApp();

app.listen(PORT, function () {
  // eslint-disable-next-line no-console
  console.log(`expense-approval-service listening on port ${PORT}`);
});
