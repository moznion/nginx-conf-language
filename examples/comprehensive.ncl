# Comprehensive NCL Example
# This file demonstrates all major features of nginx-configuration-language

# 1. Environment Variables with Default Values
worker_processes %env("WORKER_PROCESSES", "auto");
worker_connections %env("WORKER_CONNECTIONS", "1024");

# 2. Variable Definitions (Code Block Reuse)
%ssl_config = {
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers %env("SSL_CIPHERS", "ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512");
  ssl_prefer_server_ciphers off;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;
};

%security_headers = {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
  add_header X-XSS-Protection "1; mode=block";
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
};

%gzip_config = {
  gzip on;
  gzip_vary on;
  gzip_comp_level %env("GZIP_LEVEL", "6");
  gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
};

%rate_limiting = {
  limit_req zone=api burst=%env("RATE_LIMIT_BURST", "10") nodelay;
  limit_req_status 429;
};

events {
  worker_connections %env("WORKER_CONNECTIONS", "1024");
  use epoll;
}

http {
  # Basic HTTP configuration
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  
  # Logging
  access_log %env("ACCESS_LOG_PATH", "/var/log/nginx/access.log");
  error_log %env("ERROR_LOG_PATH", "/var/log/nginx/error.log");
  
  # Performance
  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  keepalive_timeout %env("KEEPALIVE_TIMEOUT", "65");
  
  # Inline expansion of gzip configuration
  %inline(%gzip_config);
  
  # Rate limiting zone  
  limit_req_zone $binary_remote_addr zone=api:10m rate=%env("RATE_LIMIT", "10r/s");
  
  # SSL Configuration Server
  server {
    listen 443 ssl http2;
    server_name %env("SSL_SERVER_NAME", "secure.example.com");
    
    # SSL certificates from environment
    ssl_certificate %env("SSL_CERT_PATH", "/etc/ssl/certs/server.crt");
    ssl_certificate_key %env("SSL_KEY_PATH", "/etc/ssl/private/server.key");
    
    # Inline SSL configuration
    %inline(%ssl_config);
    
    # Security headers
    %inline(%security_headers);
    
    # Multiple location paths with different modifiers
    location in ["/api/v1", "/api/v2", "/api/v3"] {
      %inline(%rate_limiting);
      proxy_pass %env("API_BACKEND", "http://api-backend");
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files with caching
    location in ["=/robots.txt", "=/favicon.ico", "=/sitemap.xml"] {
      root %env("STATIC_ROOT", "/var/www/static");
      expires %env("STATIC_EXPIRES", "30d");
      add_header Cache-Control "public, immutable";
      log_not_found off;
      access_log off;
    }
    
    # PHP processing
    location "~ \.php$" {
      root %env("PHP_ROOT", "/var/www/html");
      fastcgi_pass %env("PHP_FPM_SOCKET", "unix:/var/run/php-fpm.sock");
      fastcgi_index index.php;
      fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
      include fastcgi_params;
    }
    
    # Assets with far-future expires
    location "~ \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$" {
      root %env("ASSETS_ROOT", "/var/www/assets");
      expires 1y;
      add_header Cache-Control "public, immutable";
      add_header Vary Accept-Encoding;
    }
    
    # Main application
    location / {
      root %env("DOCUMENT_ROOT", "/var/www/html");
      index index.html index.php;
      try_files $uri $uri/ /index.php?$query_string;
    }
  }
  
  # HTTP to HTTPS redirect server
  server {
    listen 80;
    server_name %env("SERVER_NAME", "example.com");
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
      root %env("ACME_ROOT", "/var/www/acme");
    }
    
    # Redirect everything else to HTTPS
    location / {
      return 301 https://$host$request_uri;
    }
  }
  
  # Load balancing upstream
  upstream backend {
    server %env("BACKEND_1", "backend-1:8080") weight=%env("BACKEND_1_WEIGHT", "3");
    server %env("BACKEND_2", "backend-2:8080") weight=%env("BACKEND_2_WEIGHT", "2");
    server %env("BACKEND_3", "backend-3:8080") weight=%env("BACKEND_3_WEIGHT", "1") backup;
    
    keepalive %env("UPSTREAM_KEEPALIVE", "32");
  }
  
  # Admin interface (restricted access)
  server {
    listen %env("ADMIN_PORT", "8080");
    server_name %env("ADMIN_SERVER_NAME", "admin.example.com");
    
    # IP restriction
    allow %env("ADMIN_ALLOW_IP", "127.0.0.1");
    deny all;
    
    %inline(%security_headers);
    
    location / {
      proxy_pass %env("ADMIN_BACKEND", "http://admin-backend:3000");
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}