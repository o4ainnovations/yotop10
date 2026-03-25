module.exports = {
  apps: [
    {
      name: 'frontend',
      script: 'pnpm',
      args: 'start -- -H 0.0.0.0 -p 3000',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: '3000'
      }
    },
    {
      name: 'backend',
      script: 'pnpm',
      args: 'start',
      cwd: './backend',
      env: {
        NODE_ENV: 'production',
        PORT: '8000'
      }
    }
  ]
};
