# SSL/TLS configuration and security headers
# This file contains reusable SSL settings and security headers

%ssl_settings = {
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
  ssl_prefer_server_ciphers off;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 1d;
};

%ssl_certificates = {
  ssl_certificate /etc/ssl/certs/example.com.crt;
  ssl_certificate_key /etc/ssl/private/example.com.key;
};

%security_headers = {
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "no-referrer-when-downgrade" always;
  add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
};