module.exports = {
  apps: [
    {
      name: 'frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: '3000'
      }
    },
    {
      name: 'backend',
      script: 'dist/server.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production',
        PORT: '8000'
      }
    }
  ]
};
