import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generate } from "../src/generator/generator";
import { parse } from "../src/parser/parser";

describe("Integration Tests", () => {
	let originalEnv: typeof process.env;

	beforeEach(() => {
		// Save original environment
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv;
	});

	it("should handle complete NCL file transformation", () => {
		const input = readFileSync(
			join(__dirname, "../examples/sample.ncl"),
			"utf-8",
		);
		const ast = parse(input);
		const output = generate(ast, { expandInline: true });

		// Verify key features
		expect(output).toContain("worker_processes auto;");
		expect(output).toContain("add_header X-Frame-Options SAMEORIGIN;");
		expect(output).toContain("location /api {");
		expect(output).toContain("location = /v1 {");
		expect(output).toContain("location ~ /v2 {");
		expect(output).toContain("location ~* /v3 {");
		expect(output).toContain("location ^~ /v4 {");
		expect(output).toContain("location = /robots.txt {");
		expect(output).not.toContain("%security_headers");
		expect(output).not.toContain("%inline");
	});

	it("should handle empty NCL file", () => {
		const input = "";
		const ast = parse(input);
		const output = generate(ast);

		expect(output).toBe("");
	});

	it("should handle NCL with only comments", () => {
		const input = `# This is a comment
# Another comment`;
		const ast = parse(input);
		const output = generate(ast);

		expect(output).toBe("");
	});

	it("should preserve nginx built-in variables", () => {
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

		expect(output).toContain("$remote_addr");
		expect(output).toContain("$host");
		expect(output).toContain("$http_user_agent");
	});

	it("should handle complex nested structures", () => {
		const input = `
      %common = {
        gzip on;
        gzip_types text/plain application/json;
      };

      http {
        %inline(%common);

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

		expect(output).toContain("gzip on;");
		expect(output).toContain("upstream backend {");
		expect(output).toContain("location / {");
		expect(output).toContain("location /index.html {");
		expect(output).not.toContain("location in");
	});

	it("should handle quoted values correctly", () => {
		const input = `
      server {
        server_name example.com www.example.com;
        add_header "X-Custom Header" "Value with spaces";
        return 200 OK;
      }
    `;
		const ast = parse(input);
		const output = generate(ast);

		expect(output).toContain("example.com");
		expect(output).toContain('"X-Custom Header"');
		expect(output).toContain('"Value with spaces"');
	});

	it("should handle location modifiers correctly", () => {
		const input = `
      location = /exact { return 200; }
      location ~ /regex { return 201; }
      location ~* /case-insensitive { return 202; }
      location ^~ /prefix { return 203; }
      location /normal { return 204; }
    `;
		const ast = parse(input);
		const output = generate(ast);

		expect(output).toContain("location = /exact {");
		expect(output).toContain("location ~ /regex {");
		expect(output).toContain("location ~* /case-insensitive {");
		expect(output).toContain("location ^~ /prefix {");
		expect(output).toContain("location /normal {");
	});

	it("should error on undefined variable inline", () => {
		const input = `
      server {
        %inline(%undefined_var);
      }
    `;
		const ast = parse(input);

		expect(() => generate(ast, { expandInline: true })).toThrow(
			"Undefined variable: %undefined_var",
		);
	});

	it("should handle no-inline option", () => {
		const input = `
      %headers = {
        add_header X-Test "value";
      };

      server {
        %inline(%headers);
      }
    `;
		const ast = parse(input);
		const output = generate(ast, { expandInline: false });

		expect(output).toContain("%inline(%headers);");
		expect(output).not.toContain("add_header X-Test");
	});

	it("should handle environment variables with variable expansion", () => {
		process.env.SERVER_PORT = "8080";
		process.env.SSL_CERT = "/etc/ssl/certs/server.crt";

		const input = `
      %ssl_config = {
        ssl_certificate %env("SSL_CERT");
        ssl_protocols TLSv1.2 TLSv1.3;
      };

      server {
        listen %env("SERVER_PORT", "80");
        server_name %env("SERVER_NAME", "localhost");
        
        %inline(%ssl_config);
        
        location %env("API_PATH", "/api") {
          proxy_pass %env("BACKEND_URL", "http://localhost:3000");
        }
      }
    `;
		const ast = parse(input);
		const output = generate(ast, { expandInline: true });

		// Environment variables should be resolved
		expect(output).toContain("listen 8080;");
		expect(output).toContain("server_name localhost;"); // default value
		expect(output).toContain("ssl_certificate /etc/ssl/certs/server.crt;");
		expect(output).toContain("location /api {"); // default value
		expect(output).toContain("proxy_pass http://localhost:3000;"); // default value

		// Inline expansion should work with environment variables
		expect(output).toContain("ssl_protocols TLSv1.2 TLSv1.3;");
		expect(output).not.toContain("%ssl_config");
		expect(output).not.toContain("%env(");
	});

	it("should handle environment variables in location in syntax", () => {
		process.env.API_V1_PATH = "/api/v1";
		process.env.API_V2_PATH = "/api/v2";

		const input = `
      server {
        location in [%env("API_V1_PATH"), %env("API_V2_PATH"), "/api/v3"] {
          proxy_pass %env("API_BACKEND", "http://api-server");
        }
      }
    `;
		const ast = parse(input);
		const output = generate(ast, { expandInline: true });

		expect(output).toContain("location /api/v1 {");
		expect(output).toContain("location /api/v2 {");
		expect(output).toContain("location /api/v3 {");
		expect(output).toContain("proxy_pass http://api-server;");
		expect(output).not.toContain("location in");
	});

	it("should handle mixed nginx variables and environment variables", () => {
		process.env.LOG_FORMAT = "combined";

		const input = `
      server {
        listen %env("PORT", "80");
        access_log /var/log/nginx/access.log %env("LOG_FORMAT");
        
        location / {
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_pass %env("BACKEND_URL", "http://backend");
        }
      }
    `;
		const ast = parse(input);
		const output = generate(ast);

		// Environment variables resolved
		expect(output).toContain("listen 80;");
		expect(output).toContain("access_log /var/log/nginx/access.log combined;");
		expect(output).toContain("proxy_pass http://backend;");

		// Nginx variables preserved
		expect(output).toContain("$remote_addr");
		expect(output).toContain("$proxy_add_x_forwarded_for");
	});

	it("should handle environment variables in comprehensive configuration", () => {
		// Set some environment variables
		process.env.WORKER_PROCESSES = "4";
		process.env.SERVER_NAME = "production.example.com";
		process.env.BACKEND_URL = "http://production-backend:8080";

		const input = readFileSync(
			join(__dirname, "../examples/environment-demo.ncl"),
			"utf-8",
		);
		const ast = parse(input);
		const output = generate(ast, { expandInline: true });

		// Environment variables should be resolved correctly
		expect(output).toContain("server_name production.example.com;");
		expect(output).toContain("proxy_pass http://production-backend:8080;");

		// Default values for unset variables
		expect(output).toContain("listen 80;"); // PORT not set, uses default
		expect(output).toContain("root /var/www/html;"); // DOCUMENT_ROOT not set, uses default

		// Inline expansion should work
		expect(output).toContain("add_header X-Frame-Options SAMEORIGIN;");
		expect(output).not.toContain("%common_headers");
	});

	it("should error on missing required environment variable", () => {
		delete process.env.REQUIRED_VAR;

		const input = `
      server {
        listen %env("REQUIRED_VAR");
      }
    `;

		expect(() => parse(input)).toThrow(
			"Environment variable REQUIRED_VAR is not set and no default value provided",
		);
	});
});
