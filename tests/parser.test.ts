import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser/parser';
import { 
  ConfigNode, 
  DirectiveNode, 
  BlockNode, 
  LocationNode,
  LocationModifier,
  VariableAssignmentNode,
  InlineDirectiveNode
} from '../src/parser/ast';

describe('Parser', () => {
  describe('Basic parsing', () => {
    it('should parse simple directive', () => {
      const input = 'worker_processes auto;';
      const ast = parse(input);

      expect(ast.type).toBe('config');
      expect(ast.children).toHaveLength(1);
      
      const directive = ast.children[0] as DirectiveNode;
      expect(directive.type).toBe('directive');
      expect(directive.name).toBe('worker_processes');
      expect(directive.args).toEqual(['auto']);
    });

    it('should parse multiple directives', () => {
      const input = `
        worker_processes 4;
        worker_rlimit_nofile 65535;
      `;
      const ast = parse(input);

      expect(ast.children).toHaveLength(2);
      expect((ast.children[0] as DirectiveNode).name).toBe('worker_processes');
      expect((ast.children[1] as DirectiveNode).name).toBe('worker_rlimit_nofile');
    });

    it('should parse block directive', () => {
      const input = `
        http {
          sendfile on;
          tcp_nopush on;
        }
      `;
      const ast = parse(input);

      expect(ast.children).toHaveLength(1);
      
      const httpBlock = ast.children[0] as BlockNode;
      expect(httpBlock.type).toBe('block');
      expect(httpBlock.name).toBe('http');
      expect(httpBlock.children).toHaveLength(2);
    });

    it('should parse nested blocks', () => {
      const input = `
        http {
          server {
            listen 80;
            server_name example.com;
          }
        }
      `;
      const ast = parse(input);

      const httpBlock = ast.children[0] as BlockNode;
      const serverBlock = httpBlock.children[0] as BlockNode;
      
      expect(serverBlock.type).toBe('block');
      expect(serverBlock.name).toBe('server');
      expect(serverBlock.children).toHaveLength(2);
    });
  });

  describe('Location parsing', () => {
    it('should parse simple location', () => {
      const input = `
        location /api {
          proxy_pass http://backend;
        }
      `;
      const ast = parse(input);

      const location = ast.children[0] as LocationNode;
      expect(location.type).toBe('location');
      expect(location.modifier).toBe(LocationModifier.None);
      expect(location.paths).toEqual(['/api']);
      expect(location.children).toHaveLength(1);
    });

    it('should parse location with modifier', () => {
      const input = `
        location ~ \\.php$ {
          fastcgi_pass unix:/var/run/php-fpm.sock;
        }
      `;
      const ast = parse(input);

      const location = ast.children[0] as LocationNode;
      expect(location.modifier).toBe(LocationModifier.Regex);
      expect(location.paths).toEqual(['\\.php$']);
    });

    it('should parse location in with multiple paths', () => {
      const input = `
        location in ["/api", "/v1", "/v2"] {
          add_header X-API-Version 1;
        }
      `;
      const ast = parse(input);

      const location = ast.children[0] as LocationNode;
      expect(location.paths).toEqual(['/api', '/v1', '/v2']);
      expect(location.modifier).toBe(LocationModifier.None);
    });

    it('should parse location in with modifiers', () => {
      const input = `
        location in ["=/exact", "~/regex", "~*/case-insensitive"] {
          return 200;
        }
      `;
      const ast = parse(input);

      const location = ast.children[0] as LocationNode;
      expect(location.paths).toHaveLength(3);
      // Parser should handle modifier extraction from paths
    });
  });

  describe('Variable and inline parsing', () => {
    it('should parse variable assignment', () => {
      const input = `
        $common_headers = {
          add_header X-Frame-Options SAMEORIGIN;
          add_header X-Content-Type-Options nosniff;
        };
      `;
      const ast = parse(input);

      const assignment = ast.children[0] as VariableAssignmentNode;
      expect(assignment.type).toBe('variable_assignment');
      expect(assignment.name).toBe('$common_headers');
      expect(assignment.value.children).toHaveLength(2);
    });

    it('should parse inline directive', () => {
      const input = `
        server {
          @inline $common_headers
          listen 80;
        }
      `;
      const ast = parse(input);

      const server = ast.children[0] as BlockNode;
      const inline = server.children[0] as InlineDirectiveNode;
      
      expect(inline.type).toBe('inline');
      expect(inline.variableName).toBe('$common_headers');
    });

    it('should parse complex config with all features', () => {
      const input = `
        $security_headers = {
          add_header X-Frame-Options SAMEORIGIN;
          add_header X-XSS-Protection "1; mode=block";
        };

        http {
          server {
            listen 80;
            
            @inline $security_headers
            
            location in ["/api", "/graphql"] {
              proxy_pass http://backend;
            }
          }
        }
      `;
      const ast = parse(input);

      expect(ast.children).toHaveLength(2);
      expect(ast.children[0].type).toBe('variable_assignment');
      expect(ast.children[1].type).toBe('block');
    });
  });

  describe('Error handling', () => {
    it('should throw on unclosed block', () => {
      const input = `
        http {
          server {
            listen 80;
        }
      `;
      expect(() => parse(input)).toThrow('Expected }');
    });

    it('should throw on invalid location in syntax', () => {
      const input = `
        location in "/api" {
          return 200;
        }
      `;
      expect(() => parse(input)).toThrow('Expected [');
    });

    it('should throw on missing semicolon', () => {
      const input = `
        worker_processes auto
        worker_connections 1024;
      `;
      expect(() => parse(input)).toThrow('Expected ;');
    });
  });
});