// Fixture for /arch-diagram scenario tests (ADO-8001). Made-up application.
module.exports = {
  apps: [
    {
      name: 'portal-web',
      script: 'server.js',
      instances: 2,
      env: { PORT: 3000, DB_HOST: 'db.contoso.example.com' },
    },
    {
      name: 'portal-jobs',
      script: 'jobs.js',
      instances: 1,
      env: { DB_HOST: 'db.contoso.example.com' },
    },
  ],
};
