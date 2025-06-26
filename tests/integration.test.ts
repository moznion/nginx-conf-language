import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/parser';
import { generate } from '../src/generator/generator';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Integration Tests', () => {
  it('should handle complete NCL file transformation', () => {
    const input = readFileSync(join(__dirname, '../examples/sample.ncl'), 'utf-8');
    const ast = parse(input);
    const output = generate(ast, { expandInline: true });

    // Verify key features
    expect(output).toContain('worker_processes auto;');
    expect(output).toContain('add_header X-Frame-Options SAMEORIGIN;');
    expect(output).toContain('location /api {');
    expect(output).toContain('location = /v1 {');
    expect(output).toContain('location ~ /v2 {');
    expect(output).toContain('location ~* /v3 {');
    expect(output).toContain('location ^~ /v4 {');
    expect(output).toContain('location = /robots.txt {');
    expect(output).not.toContain('$security_headers');
    expect(output).not.toContain('@inline');
  });

  it('should handle empty NCL file', () => {
    const input = '';
    const ast = parse(input);
    const output = generate(ast);

    expect(output).toBe('');
  });

  it('should handle NCL with only comments', () => {
    const input = `# This is a comment
# Another comment`;
    const ast = parse(input);
    const output = generate(ast);

    expect(output).toBe('');
  });

  it('should preserve nginx built-in variables', () => {
    const input = `
      server {
        set $my_var "value";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
        if ($http_user_agent ~* "bot") {
          return 403;
        }
      }
    `;
    const ast = parse(input);
    const output = generate(ast);

    expect(output).toContain('$remote_addr');
    expect(output).toContain('$host');
    expect(output).toContain('$http_user_agent');
  });

  it('should handle complex nested structures', () => {
    const input = `
      $common = {
        gzip on;
        gzip_types text/plain application/json;
      };

      http {
        @inline $common

        upstream backend {
          server 127.0.0.1:8080;
          server 127.0.0.1:8081;
        }

        server {
          listen 80;

          location in ["/", "/index.html"] {
            root /var/www;
            try_files "$uri" "$uri/" =404;
          }

          location ~ \\.php$ {
            fastcgi_pass unix:/var/run/php-fpm.sock;
          }
        }
      }
    `;
    const ast = parse(input);
    const output = generate(ast, { expandInline: true });

    expect(output).toContain('gzip on;');
    expect(output).toContain('upstream backend {');
    expect(output).toContain('location / {');
    expect(output).toContain('location /index.html {');
    expect(output).not.toContain('location in');
  });

  it('should handle quoted values correctly', () => {
    const input = `
      server {
        server_name example.com www.example.com;
        add_header "X-Custom Header" "Value with spaces";
        return 200 OK;
      }
    `;
    const ast = parse(input);
    const output = generate(ast);

    expect(output).toContain('example.com');
    expect(output).toContain('"X-Custom Header"');
    expect(output).toContain('"Value with spaces"');
  });

  it('should handle location modifiers correctly', () => {
    const input = `
      location = /exact { return 200; }
      location ~ /regex { return 201; }
      location ~* /case-insensitive { return 202; }
      location ^~ /prefix { return 203; }
      location /normal { return 204; }
    `;
    const ast = parse(input);
    const output = generate(ast);

    expect(output).toContain('location = /exact {');
    expect(output).toContain('location ~ /regex {');
    expect(output).toContain('location ~* /case-insensitive {');
    expect(output).toContain('location ^~ /prefix {');
    expect(output).toContain('location /normal {');
  });

  it('should error on undefined variable inline', () => {
    const input = `
      server {
        @inline $undefined_var
      }
    `;
    const ast = parse(input);

    expect(() => generate(ast, { expandInline: true }))
      .toThrow('Undefined variable: $undefined_var');
  });

  it('should handle no-inline option', () => {
    const input = `
      $headers = {
        add_header X-Test "value";
      };

      server {
        @inline $headers
      }
    `;
    const ast = parse(input);
    const output = generate(ast, { expandInline: false });

    expect(output).toContain('@inline $headers');
    expect(output).not.toContain('add_header X-Test');
  });
});
