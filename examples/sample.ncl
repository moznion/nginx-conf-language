%security_headers = {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
  add_header X-XSS-Protection "1; mode=block";
};

%cache_headers = {
  expires "1h";
  add_header Cache-Control "public, max-age=3600";
};

worker_processes auto;

http {
  sendfile on;
  tcp_nopush on;

  server {
    listen 80;
    server_name example.com;

    %inline %security_headers

    location / {
      root /var/www/html;
      index index.html;
    }

    location in ["/api", "=/v1", "~/v2", "~*/v3", "^~/v4"] {
      proxy_pass http://backend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location ~ \.php$ {
      fastcgi_pass unix:/var/run/php-fpm.sock;
      fastcgi_index index.php;
      include fastcgi_params;
    }

    location in ["=/robots.txt", "=/favicon.ico"] {
      %inline %cache_headers
      log_not_found off;
      access_log off;
    }
  }
}
