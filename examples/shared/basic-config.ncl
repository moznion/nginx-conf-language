# Basic nginx configuration settings
# This file contains fundamental nginx directives

worker_processes auto;
worker_connections 1024;

events {
  use epoll;
  multi_accept on;
}

error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;