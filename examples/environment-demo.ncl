# Environment Variables Demo
# This file demonstrates environment variable usage in NCL

%common_headers = {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
};

server {
  # Environment variables with default values
  listen %env("PORT", "80");
  server_name %env("SERVER_NAME", "localhost");
  
  # Environment variable with default
  access_log %env("ACCESS_LOG", "/var/log/nginx/access.log");
  
  %inline %common_headers
  
  location / {
    root %env("DOCUMENT_ROOT", "/var/www/html");
    index index.html;
  }
  
  # Environment variables in location paths
  location %env("API_PATH", "/api") {
    proxy_pass %env("BACKEND_URL", "http://localhost:3000");
    proxy_set_header Host $host;
  }
}