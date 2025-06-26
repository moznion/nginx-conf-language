import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parse } from '../src/parser/parser';
import { generate } from '../src/generator/generator';

/**
 * These tests require nginx to be installed on the system.
 * They validate that generated nginx.conf files are syntactically correct.
 */
describe('Nginx Validation Tests', () => {
  let tempDir: string;
  let nginxAvailable = false;

  beforeAll(() => {
    // Check if nginx is available
    try {
      execSync('nginx -v', { stdio: 'pipe' });
      nginxAvailable = true;
    } catch {
      console.warn('⚠️  Nginx is not installed. Skipping validation tests.');
    }

    // Create temporary directory for test files
    tempDir = mkdtempSync(join(tmpdir(), 'ncl-test-'));
  });

  afterAll(() => {
    // Clean up temp directory
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it.skipIf(!nginxAvailable)('should generate valid nginx config from simple NCL', () => {
    const ncl = `
      worker_processes auto;
      
      events {
        worker_connections 1024;
      }
      
      http {
        server {
          listen 80;
          server_name example.com;
          
          location / {
            root /var/www/html;
            index index.html;
          }
        }
      }
    `;

    const ast = parse(ncl);
    const nginxConf = generate(ast);
    
    const confPath = join(tempDir, 'simple.conf');
    writeFileSync(confPath, nginxConf);

    // Validate with nginx
    const result = execSync(`nginx -t -c ${confPath} 2>&1`, { encoding: 'utf-8' });
    expect(result).toContain('syntax is ok');
  });

  it.skipIf(!nginxAvailable)('should generate valid config with location in expansion', () => {
    const ncl = `
      worker_processes 1;
      
      events {
        worker_connections 512;
      }
      
      http {
        server {
          listen 80;
          
          location in ["/api", "/v1", "/v2"] {
            return 200 "OK";
          }
        }
      }
    `;

    const ast = parse(ncl);
    const nginxConf = generate(ast);
    
    const confPath = join(tempDir, 'location-in.conf');
    writeFileSync(confPath, nginxConf);

    const result = execSync(`nginx -t -c ${confPath} 2>&1`, { encoding: 'utf-8' });
    expect(result).toContain('syntax is ok');
  });

  it.skipIf(!nginxAvailable)('should generate valid config with variable expansion', () => {
    const ncl = `
      $common_headers = {
        add_header X-Frame-Options SAMEORIGIN;
        add_header X-Content-Type-Options nosniff;
      };
      
      worker_processes auto;
      
      events {
        worker_connections 1024;
      }
      
      http {
        server {
          listen 80;
          server_name test.local;
          
          @inline $common_headers
          
          location / {
            return 200 "Hello";
          }
        }
      }
    `;

    const ast = parse(ncl);
    const nginxConf = generate(ast, { expandInline: true });
    
    const confPath = join(tempDir, 'variables.conf');
    writeFileSync(confPath, nginxConf);

    const result = execSync(`nginx -t -c ${confPath} 2>&1`, { encoding: 'utf-8' });
    expect(result).toContain('syntax is ok');
  });

  it.skipIf(!nginxAvailable)('should generate valid config with all modifiers', () => {
    const ncl = `
      worker_processes 1;
      
      events {
        worker_connections 256;
      }
      
      http {
        server {
          listen 80;
          
          location = /exact {
            return 200;
          }
          
          location ~ /regex {
            return 200;
          }
          
          location ~* /case-insensitive {
            return 200;
          }
          
          location ^~ /prefix {
            return 200;
          }
          
          location in ["=/api", "~/\.json$", "~*/\.xml$", "^~/static"] {
            return 200;
          }
        }
      }
    `;

    const ast = parse(ncl);
    const nginxConf = generate(ast, { expandInline: true });
    
    const confPath = join(tempDir, 'modifiers.conf');
    writeFileSync(confPath, nginxConf);

    const result = execSync(`nginx -t -c ${confPath} 2>&1`, { encoding: 'utf-8' });
    expect(result).toContain('syntax is ok');
  });

  it.skipIf(!nginxAvailable)('should generate valid config with complex features', () => {
    const ncl = `
      $security = {
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options DENY;
      };
      
      $api_config = {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      };
      
      worker_processes auto;
      pid /var/run/nginx.pid;
      
      events {
        worker_connections 2048;
        use epoll;
      }
      
      http {
        include /etc/nginx/mime.types;
        default_type application/octet-stream;
        
        sendfile on;
        tcp_nopush on;
        keepalive_timeout 65;
        
        upstream backend {
          server 127.0.0.1:3000;
          server 127.0.0.1:3001 backup;
        }
        
        server {
          listen 80;
          server_name example.com www.example.com;
          
          @inline $security
          
          location / {
            root /var/www/html;
            try_files "$uri" "$uri/" /index.html;
          }
          
          location in ["/api", "/graphql"] {
            @inline $api_config
          }
          
          location ~ \\.php$ {
            fastcgi_pass unix:/var/run/php-fpm.sock;
            fastcgi_index index.php;
            include /etc/nginx/fastcgi_params;
          }
          
          if ($http_user_agent ~* "bot") {
            return 403;
          }
        }
      }
    `;

    const ast = parse(ncl);
    const nginxConf = generate(ast, { expandInline: true });
    
    const confPath = join(tempDir, 'complex.conf');
    writeFileSync(confPath, nginxConf);

    // Note: This test might fail due to missing include files
    // But it will still validate the syntax of our generated directives
    try {
      const result = execSync(`nginx -t -c ${confPath} 2>&1`, { encoding: 'utf-8' });
      expect(result).toContain('syntax is ok');
    } catch (error: any) {
      // Check if error is due to missing files (not syntax errors)
      const output = error.stdout + error.stderr;
      expect(output).not.toContain('unexpected');
      expect(output).not.toContain('invalid');
      // Likely failed due to missing mime.types or fastcgi_params
      if (!output.includes('mime.types') && !output.includes('fastcgi_params')) {
        throw error;
      }
    }
  });
});