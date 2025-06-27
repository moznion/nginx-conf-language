/**
 * Tests for environment variable support
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tokenize, TokenType } from '../src/parser/tokenizer';
import { parse } from '../src/parser/parser';
import { generate } from '../src/generator/generator';

describe('Environment Variables', () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Tokenizer', () => {
    it('should tokenize %env() syntax', () => {
      const input = '%env("PORT")';
      const tokens = tokenize(input);
      
      expect(tokens).toHaveLength(5); // %env, (, "PORT", ), EOF
      expect(tokens[0]).toMatchObject({
        type: TokenType.EnvVar,
        value: '%env'
      });
      expect(tokens[1]).toMatchObject({
        type: TokenType.LeftParen,
        value: '('
      });
      expect(tokens[2]).toMatchObject({
        type: TokenType.String,
        value: 'PORT'
      });
      expect(tokens[3]).toMatchObject({
        type: TokenType.RightParen,
        value: ')'
      });
    });

    it('should tokenize %env() with default value', () => {
      const input = '%env("PORT", "8080")';
      const tokens = tokenize(input);
      
      expect(tokens).toHaveLength(7); // %env, (, "PORT", ,, "8080", ), EOF
      expect(tokens[0].type).toBe(TokenType.EnvVar);
      expect(tokens[2].value).toBe('PORT');
      expect(tokens[4].value).toBe('8080');
    });
  });

  describe('Parser', () => {
    it('should parse %env() in directive arguments', () => {
      process.env.PORT = '3000';
      
      const input = 'listen %env("PORT");';
      const ast = parse(input);
      
      expect(ast.children).toHaveLength(1);
      const directive = ast.children[0] as any;
      expect(directive.type).toBe('directive');
      expect(directive.name).toBe('listen');
      expect(directive.args).toEqual(['3000']);
    });

    it('should parse %env() with default value', () => {
      // Don't set PORT environment variable
      delete process.env.PORT;
      
      const input = 'listen %env("PORT", "8080");';
      const ast = parse(input);
      
      const directive = ast.children[0] as any;
      expect(directive.args).toEqual(['8080']);
    });

    it('should parse %env() in block arguments', () => {
      process.env.UPSTREAM_NAME = 'backend';
      
      const input = 'upstream %env("UPSTREAM_NAME") { }';
      const ast = parse(input);
      
      const block = ast.children[0] as any;
      expect(block.type).toBe('block');
      expect(block.name).toBe('upstream');
      expect(block.args).toEqual(['backend']);
    });

    it('should throw error for undefined environment variable without default', () => {
      delete process.env.UNDEFINED_VAR;
      
      const input = 'listen %env("UNDEFINED_VAR");';
      
      expect(() => parse(input)).toThrow('Environment variable UNDEFINED_VAR is not set and no default value provided');
    });
  });

  describe('Generator', () => {
    it('should handle environment variables in complex configuration', () => {
      process.env.SERVER_PORT = '80';
      process.env.SERVER_NAME = 'example.com';
      process.env.ROOT_PATH = '/var/www/html';
      
      const input = `
        server {
          listen %env("SERVER_PORT");
          server_name %env("SERVER_NAME");
          root %env("ROOT_PATH");
          
          location / {
            try_files $uri $uri/ =404;
          }
        }
      `;
      
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output).toContain('listen 80;');
      expect(output).toContain('server_name example.com;');
      expect(output).toContain('root /var/www/html;');
    });

    it('should handle environment variables with quoted values', () => {
      process.env.LOG_FORMAT = 'combined';
      
      const input = 'access_log /var/log/nginx/access.log %env("LOG_FORMAT");';
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output).toBe('access_log /var/log/nginx/access.log combined;');
    });
  });

  describe('Integration', () => {
    it('should support environment variables in location blocks', () => {
      process.env.API_PATH = '/api';
      process.env.API_HOST = 'api.example.com';
      
      const input = `
        location %env("API_PATH") {
          proxy_pass %env("API_HOST");
          proxy_set_header Host $host;
        }
      `;
      
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output).toContain('location /api {');
      expect(output).toContain('proxy_pass api.example.com;');
    });

    it('should work with variable assignments and inline expansion', () => {
      process.env.SSL_CERT = '/etc/ssl/certs/example.crt';
      process.env.SSL_KEY = '/etc/ssl/private/example.key';
      
      const input = `
        %ssl_config = {
          ssl_certificate %env("SSL_CERT");
          ssl_certificate_key %env("SSL_KEY");
          ssl_protocols TLSv1.2 TLSv1.3;
        };
        
        server {
          listen 443 ssl;
          %inline(%ssl_config);
        }
      `;
      
      const ast = parse(input);
      const output = generate(ast, { expandInline: true });
      
      expect(output).toContain('ssl_certificate /etc/ssl/certs/example.crt;');
      expect(output).toContain('ssl_certificate_key /etc/ssl/private/example.key;');
      expect(output).toContain('ssl_protocols TLSv1.2 TLSv1.3;');
      expect(output).not.toContain('%ssl_config');
    });

    it('should handle default values in production scenarios', () => {
      // Simulate missing environment variables
      delete process.env.WORKER_PROCESSES;
      delete process.env.CLIENT_MAX_BODY_SIZE;
      
      const input = `
        worker_processes %env("WORKER_PROCESSES", "auto");
        client_max_body_size %env("CLIENT_MAX_BODY_SIZE", "10M");
        
        server {
          listen 80;
          server_name localhost;
        }
      `;
      
      const ast = parse(input);
      const output = generate(ast);
      
      expect(output).toContain('worker_processes auto;');
      expect(output).toContain('client_max_body_size 10M;');
    });
  });
});