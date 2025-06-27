import { describe, it, expect } from 'vitest';
import { generate } from '../src/generator/generator';
import { parse } from '../src/parser/parser';

describe('Generator', () => {
  describe('Basic generation', () => {
    it('should generate simple directive', () => {
      const input = 'worker_processes auto;';
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe('worker_processes auto;');
    });

    it('should generate multiple directives', () => {
      const input = `worker_processes 4;
worker_rlimit_nofile 65535;`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe(`worker_processes 4;
worker_rlimit_nofile 65535;`);
    });

    it('should generate block directive', () => {
      const input = `http {
  sendfile on;
  tcp_nopush on;
}`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe(`http {
  sendfile on;
  tcp_nopush on;
}`);
    });

    it('should generate nested blocks with proper indentation', () => {
      const input = `http {
  server {
    listen 80;
    server_name example.com;
  }
}`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe(`http {
  server {
    listen 80;
    server_name example.com;
  }
}`);
    });
  });

  describe('Location generation', () => {
    it('should generate simple location', () => {
      const input = `location /api {
  proxy_pass http://backend;
}`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe(`location /api {
  proxy_pass http://backend;
}`);
    });

    it('should generate location with modifier', () => {
      const input = `location ~ \\.php$ {
  fastcgi_pass unix:/var/run/php-fpm.sock;
}`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe(`location ~ \\.php$ {
  fastcgi_pass unix:/var/run/php-fpm.sock;
}`);
    });

    it('should expand location in to multiple location blocks', () => {
      const input = `location in ["/api", "/v1", "/v2"] {
  add_header X-API-Version 1;
}`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe(`location /api {
  add_header X-API-Version 1;
}
location /v1 {
  add_header X-API-Version 1;
}
location /v2 {
  add_header X-API-Version 1;
}`);
    });

    it('should handle location in with modifiers', () => {
      const input = `location in ["=/exact", "~/regex"] {
  return 200;
}`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe(`location = /exact {
  return 200;
}
location ~ /regex {
  return 200;
}`);
    });
  });

  describe('Variable and inline generation', () => {
    it('should not output variable assignments', () => {
      const input = `%common_headers = {
  add_header X-Frame-Options SAMEORIGIN;
};`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe('');
    });

    it('should expand inline directives', () => {
      const input = `%common_headers = {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
};

server {
  %inline(%common_headers);
  listen 80;
}`;
      const ast = parse(input);
      const output = generate(ast, { expandInline: true });
      
      expect(output.trim()).toBe(`server {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
  listen 80;
}`);
    });

    it('should handle complex config with all features', () => {
      const input = `%security_headers = {
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-XSS-Protection "1; mode=block";
};

http {
  server {
    listen 80;
    
    %inline(%security_headers);
    
    location in ["/api", "/graphql"] {
      proxy_pass http://backend;
    }
  }
}`;
      const ast = parse(input);
      const output = generate(ast, { expandInline: true });
      
      expect(output.trim()).toBe(`http {
  server {
    listen 80;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    location /api {
      proxy_pass http://backend;
    }
    location /graphql {
      proxy_pass http://backend;
    }
  }
}`);
    });
  });

  describe('Formatting options', () => {
    it('should support custom indentation', () => {
      const input = `http {
  server {
    listen 80;
  }
}`;
      const ast = parse(input);
      const output = generate(ast, { indent: '    ' }); // 4 spaces
      
      expect(output.trim()).toBe(`http {
    server {
        listen 80;
    }
}`);
    });

    it('should handle quoted arguments properly', () => {
      const input = `add_header "X-Custom-Header" "value with spaces";`;
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output.trim()).toBe(`add_header X-Custom-Header "value with spaces";`);
    });
  });

  describe('Error handling', () => {
    it('should throw when inline variable is not defined', () => {
      const input = `server {
  %inline(%undefined_var);
}`;
      const ast = parse(input);
      
      expect(() => generate(ast, { expandInline: true }))
        .toThrow('Undefined variable: %undefined_var');
    });
  });
});