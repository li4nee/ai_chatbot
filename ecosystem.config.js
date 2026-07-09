module.exports = {
  apps: [
    {
      name: 'ai-chatbot-backend',
      cwd: './backend',
      script: 'npm',
      args: 'run start:prod',
      env: {
        NODE_ENV: 'production',
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
