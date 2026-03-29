module.exports = {
  apps: [
    {
      name: 'frontend',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '0.0.0.0'
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
