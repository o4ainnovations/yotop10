#!/bin/bash

# Script to configure Nginx and Certbot for yotop10.fun

# Update packages
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# Move Nginx config to sites-available
sudo cp nginx.conf.template /etc/nginx/sites-available/yotop10.fun
sudo ln -s /etc/nginx/sites-available/yotop10.fun /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Obtain SSL certificate
sudo certbot --nginx -d yotop10.fun -d www.yotop10.fun --non-interactive --agree-tos --email admin@yotop10.fun

echo "Nginx and Certbot configuration complete."
