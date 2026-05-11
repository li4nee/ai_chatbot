module.exports = {
  apps: [
    {
      name: 'ai-chatbot-backend',
      cwd: './backend',
      script: 'npm',
      args: 'run start:prod',
      env: {
        NODE_ENV: 'production',
        // Best practice: Set database credentials here or in a production .env
        // DB_HOST: 'your-production-db-host',
        // DB_PORT: 5432,
        // DB_USERNAME: 'your-production-db-user',
        // DB_PASSWORD: 'your-production-db-password',
        // DB_NAME: 'your-production-db-name',
        // DB_SSL: 'true', 
      },
    },
    {
      name: 'ai-chatbot-admin',
      cwd: './admin',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
