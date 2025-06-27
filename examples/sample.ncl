%security_headers = {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
  add_header X-XSS-Protection "1; mode=block";
};

%cache_headers = {
  expires %env("CACHE_DURATION", "1h");
  add_header Cache-Control %env("CACHE_CONTROL", "public, max-age=3600");
};

worker_processes %env("WORKER_PROCESSES", "auto");

http {
  sendfile on;
  tcp_nopush on;

  server {
    listen %env("PORT", "80");
    server_name %env("SERVER_NAME", "example.com");

    %inline(%security_headers);

    location / {
      root %env("DOCUMENT_ROOT", "/var/www/html");
      index index.html;
    }

    location in ["/api", "=/v1", "~/v2", "~*/v3", "^~/v4"] {
      proxy_pass %env("BACKEND_URL", "http://backend");
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location ~ \.php$ {
      fastcgi_pass %env("PHP_FPM_SOCKET", "unix:/var/run/php-fpm.sock");
      fastcgi_index index.php;
      include fastcgi_params;
    }

    location in ["=/robots.txt", "=/favicon.ico"] {
      %inline(%cache_headers);
      log_not_found off;
      access_log off;
    }
  }
}
