# nginx-configuration-language

A Domain-Specific Language (DSL) for generating nginx.conf files with enhanced features, written in TypeScript.

## Features

nginx-configuration-language (NCL) provides nginx.conf-compatible syntax with additional features:

### 1. Environment Variables
Dynamically inject environment variables into your configuration:

```ncl
server {
  listen %env("PORT", "80");
  server_name %env("SERVER_NAME", "localhost");
  
  location / {
    root %env("DOCUMENT_ROOT", "/var/www/html");
    proxy_pass %env("BACKEND_URL");
  }
}
```

Environment variables are resolved at generation time:
```bash
PORT=3000 SERVER_NAME=example.com BACKEND_URL=http://api.internal ncl-gen config.ncl
```

### 2. Import Files
Create modular, reusable configurations using `%import`:

```ncl
# shared/ssl-config.ncl
%ssl_settings = {
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_session_cache shared:SSL:10m;
};

# main.ncl
%import("./shared/ssl-config.ncl");

server {
  listen 443 ssl;
  %inline(%ssl_settings);
}
```

Features:
- **Relative paths**: Import files relative to current file location
- **Absolute paths**: Use absolute paths for system-wide configurations
- **Circular dependency detection**: Prevents infinite import loops
- **Variable sharing**: Imported files can define variables for use in importing files
- **Content inlining**: Imported content is expanded inline at generation time

### 3. Multiple Location Paths
Define multiple location blocks with a single statement using `location in`:

```ncl
location in ["/api", "/v1", "/v2"] {
  proxy_pass http://backend;
}
```

Generates:
```nginx
location /api {
  proxy_pass http://backend;
}
location /v1 {
  proxy_pass http://backend;
}
location /v2 {
  proxy_pass http://backend;
}
```

### 4. Code Block Variables
Define reusable code blocks with variables:

```ncl
%security_headers = {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
};
```

### 5. Inline Expansion
Use `%inline` to expand code blocks:

```ncl
server {
  %inline(%security_headers);
  listen 80;
}
```

## Installation

```bash
npm install nginx-conf-language
```

## Usage

### Command Line

Convert NCL files to nginx.conf using the `ncl-gen` command:

```bash
# Convert sample.ncl to sample.conf
ncl-gen sample.ncl

# Specify output file
ncl-gen sample.ncl -o /etc/nginx/nginx.conf

# Output to stdout
ncl-gen sample.ncl --stdout

# Disable inline expansion
ncl-gen sample.ncl --no-inline
```

### Programmatic API

```typescript
import { parse, generate } from 'nginx-conf-language';

const nclContent = `
  %cache_headers = {
    expires 1h;
    add_header Cache-Control "public";
  };

  server {
    listen %env("PORT", "80");
    server_name %env("DOMAIN", "localhost");
    %inline(%cache_headers);
  }
`;

const ast = parse(nclContent);
const nginxConf = generate(ast, { expandInline: true });
console.log(nginxConf);
```

## Example

Input file (`example.ncl`):
```ncl
%security_headers = {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
  add_header X-XSS-Protection "1; mode=block";
};

worker_processes %env("WORKER_PROCESSES", "auto");

http {
  server {
    listen %env("PORT", "80");
    server_name %env("SERVER_NAME", "example.com");

    %inline(%security_headers);

    location in ["/api", "/graphql"] {
      proxy_pass %env("BACKEND_URL", "http://backend");
      proxy_set_header Host $host;
    }

    location ~ \.php$ {
      fastcgi_pass unix:/var/run/php-fpm.sock;
    }
  }
}
```

Output file (`example.conf`) with environment variables:
```bash
# With environment variables set
PORT=8080 SERVER_NAME=myapp.com BACKEND_URL=http://api.internal ncl-gen example.ncl
```

```nginx
worker_processes auto;
http {
  server {
    listen 8080;
    server_name myapp.com;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    location /api {
      proxy_pass http://api.internal;
      proxy_set_header Host $host;
    }
    location /graphql {
      proxy_pass http://api.internal;
      proxy_set_header Host $host;
    }
    location ~ \.php$ {
      fastcgi_pass unix:/var/run/php-fpm.sock;
    }
  }
}
```

Or with default values (no environment variables set):
```nginx
worker_processes auto;
http {
  server {
    listen 80;
    server_name example.com;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    location /api {
      proxy_pass http://backend;
      proxy_set_header Host $host;
    }
    location /graphql {
      proxy_pass http://backend;
      proxy_set_header Host $host;
    }
    location ~ \.php$ {
      fastcgi_pass unix:/var/run/php-fpm.sock;
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run nginx validation tests (requires Docker)
npm test -- tests/nginx-docker-validation.test.ts

# Legacy nginx validation tests (requires nginx installed locally)
npm test -- tests/nginx-validation.test.ts
```

### Testing

The project includes comprehensive test coverage:

- **Unit tests**: Test individual components (tokenizer, parser, generator)
- **Integration tests**: Test complete NCL to nginx.conf transformation
- **Docker validation tests**: Validate generated configs using Docker + nginx (recommended)
- **Legacy nginx validation tests**: Validate using local nginx installation

Docker validation tests automatically skip if Docker is not available. They use the official nginx:alpine image to ensure consistent validation across different environments.

## License

MIT
