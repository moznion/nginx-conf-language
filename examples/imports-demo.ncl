# Import Functionality Demo
# This file demonstrates the new %import feature for modular nginx configurations

# Import shared configurations
%import("./shared/basic-config.ncl");
%import("./shared/ssl-config.ncl");

# Define local variables
%local_servers = {
  upstream app_backend {
    server 127.0.0.1:3000 weight=3;
    server 127.0.0.1:3001 weight=2;
  }
};

http {
  # Include imported SSL configuration  
  %inline(%ssl_settings);
  
  # Use local server configuration
  %inline(%local_servers);
  
  server {
    listen 80;
    server_name example.com www.example.com;
    
    # Include imported security headers
    %inline(%security_headers);
    
    location / {
      proxy_pass http://app_backend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /static/ {
      alias /var/www/static/;
      expires 30d;
    }
  }
  
  server {
    listen 443 ssl;
    server_name example.com www.example.com;
    
    # Include imported SSL configuration
    %inline(%ssl_certificates);
    %inline(%security_headers);
    
    location / {
      proxy_pass http://app_backend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
}