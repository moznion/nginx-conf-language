/**
 * Tests for import functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TokenType, tokenize } from '../src/parser/tokenizer';
import { Parser } from '../src/parser/parser';
import { generate } from '../src/generator/generator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function parseNcl(input: string) {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parse();
}

describe('Import Tokenizer Tests', () => {
  test('should tokenize %import directive', () => {
    const input = '%import("/path/to/file.ncl");';
    const tokens = tokenize(input);
    
    expect(tokens).toHaveLength(6); // %import, (, string, ), ;, EOF
    expect(tokens[0]).toEqual({
      type: TokenType.Import,
      value: '%import',
      line: 1,
      column: 1
    });
    expect(tokens[1].type).toBe(TokenType.LeftParen);
    expect(tokens[2]).toEqual({
      type: TokenType.String,
      value: '/path/to/file.ncl',
      line: 1,
      column: 9
    });
    expect(tokens[3].type).toBe(TokenType.RightParen);
    expect(tokens[4].type).toBe(TokenType.Semicolon);
  });

  test('should tokenize multiple imports', () => {
    const input = `
      %import("./common.ncl");
      %import("/etc/nginx/shared.ncl");
    `;
    const tokens = tokenize(input);
    
    const importTokens = tokens.filter(t => t.type === TokenType.Import);
    expect(importTokens).toHaveLength(2);
  });
});

describe('Import Parser Tests', () => {
  test('should parse %import directive', () => {
    const input = '%import("/path/to/file.ncl");';
    const ast = parseNcl(input);
    
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toEqual({
      type: 'import',
      path: '/path/to/file.ncl',
      position: { line: 1, column: 1 }
    });
  });

  test('should parse import with relative path', () => {
    const input = '%import("./relative/path.ncl");';
    const ast = parseNcl(input);
    
    expect(ast.children[0]).toEqual({
      type: 'import',
      path: './relative/path.ncl',
      position: { line: 1, column: 1 }
    });
  });

  test('should handle parse errors for malformed import', () => {
    const inputs = [
      '%import();',  // Empty path
      '%import("/path"',  // Missing closing parenthesis
      '%import("unclosed string;'  // Unclosed string
    ];

    inputs.forEach(input => {
      expect(() => parseNcl(input)).toThrow();
    });
  });
});

describe('Import Generator Tests', () => {
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ncl-import-test-'));
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should generate content from imported file', () => {
    // Create import file
    const importContent = `
      worker_processes auto;
      worker_connections 1024;
    `;
    const importPath = path.join(tempDir, 'common.ncl');
    fs.writeFileSync(importPath, importContent);
    
    // Create main file with import
    const mainContent = `
      %import("${importPath}");
      
      http {
        server {
          listen 80;
        }
      }
    `;
    const mainPath = path.join(tempDir, 'main.ncl');
    fs.writeFileSync(mainPath, mainContent);
    
    const ast = parseNcl(mainContent);
    const result = generate(ast, {}, mainPath);
    
    expect(result).toContain('worker_processes auto;');
    expect(result).toContain('worker_connections 1024;');
    expect(result).toContain('http {');
    expect(result).toContain('listen 80;');
  });

  test('should handle relative imports', () => {
    // Create subdirectory and import file
    const subDir = path.join(tempDir, 'config');
    fs.mkdirSync(subDir);
    
    const importContent = 'keepalive_timeout 65;';
    const importPath = path.join(subDir, 'timeouts.ncl');
    fs.writeFileSync(importPath, importContent);
    
    // Create main file with relative import
    const mainContent = '%import("./config/timeouts.ncl");';
    const mainPath = path.join(tempDir, 'main.ncl');
    fs.writeFileSync(mainPath, mainContent);
    
    const ast = parseNcl(mainContent);
    const result = generate(ast, {}, mainPath);
    
    expect(result).toBe('keepalive_timeout 65;');
  });

  test('should detect circular dependencies', () => {
    // Create file A that imports B
    const fileAContent = '%import("./fileB.ncl");';
    const fileAPath = path.join(tempDir, 'fileA.ncl');
    fs.writeFileSync(fileAPath, fileAContent);
    
    // Create file B that imports A (circular)
    const fileBContent = '%import("./fileA.ncl");';
    const fileBPath = path.join(tempDir, 'fileB.ncl');
    fs.writeFileSync(fileBPath, fileBContent);
    
    const ast = parseNcl(fileAContent);
    
    expect(() => generate(ast, {}, fileAPath)).toThrow(/Circular dependency detected/);
  });

  test('should detect complex circular dependencies', () => {
    // Create A -> B -> C -> A cycle
    const fileAContent = '%import("./fileB.ncl");';
    const fileBContent = '%import("./fileC.ncl");';
    const fileCContent = '%import("./fileA.ncl");';
    
    fs.writeFileSync(path.join(tempDir, 'fileA.ncl'), fileAContent);
    fs.writeFileSync(path.join(tempDir, 'fileB.ncl'), fileBContent);
    fs.writeFileSync(path.join(tempDir, 'fileC.ncl'), fileCContent);
    
    const ast = parseNcl(fileAContent);
    
    expect(() => generate(ast, {}, path.join(tempDir, 'fileA.ncl'))).toThrow(/Circular dependency detected/);
  });

  test('should handle imports with variables', () => {
    // Create import file with variable definition
    const importContent = `
      %backend_servers = {
        upstream backend {
          server 127.0.0.1:3000;
          server 127.0.0.1:3001;
        }
      };
    `;
    const importPath = path.join(tempDir, 'backend.ncl');
    fs.writeFileSync(importPath, importContent);
    
    // Create main file that uses the imported variable
    const mainContent = `
      %import("${importPath}");
      
      http {
        %inline(%backend_servers);
        
        server {
          location / {
            proxy_pass http://backend;
          }
        }
      }
    `;
    const mainPath = path.join(tempDir, 'main.ncl');
    fs.writeFileSync(mainPath, mainContent);
    
    const ast = parseNcl(mainContent);
    const result = generate(ast, { expandInline: true }, mainPath);
    
    expect(result).toContain('upstream backend');
    expect(result).toContain('server 127');
    expect(result).toContain('3000');
    expect(result).toContain('proxy_pass http://backend;');
  });

  test('should handle multiple imports', () => {
    // Create multiple import files
    const import1Content = 'worker_processes auto;';
    const import2Content = 'worker_connections 1024;';
    
    const import1Path = path.join(tempDir, 'workers.ncl');
    const import2Path = path.join(tempDir, 'connections.ncl');
    
    fs.writeFileSync(import1Path, import1Content);
    fs.writeFileSync(import2Path, import2Content);
    
    // Create main file with multiple imports
    const mainContent = `
      %import("${import1Path}");
      %import("${import2Path}");
      
      error_log /var/log/nginx/error.log;
    `;
    const mainPath = path.join(tempDir, 'main.ncl');
    fs.writeFileSync(mainPath, mainContent);
    
    const ast = parseNcl(mainContent);
    const result = generate(ast, {}, mainPath);
    
    expect(result).toContain('worker_processes auto;');
    expect(result).toContain('worker_connections 1024;');
    expect(result).toContain('error_log /var/log/nginx/error.log;');
  });

  test('should handle import file not found', () => {
    const mainContent = '%import("./nonexistent.ncl");';
    const mainPath = path.join(tempDir, 'main.ncl');
    
    const ast = parseNcl(mainContent);
    
    expect(() => generate(ast, {}, mainPath)).toThrow(/Import file not found/);
  });

  test('should cache imported files', () => {
    // Create import file
    const importContent = 'worker_processes auto;';
    const importPath = path.join(tempDir, 'common.ncl');
    fs.writeFileSync(importPath, importContent);
    
    // Create main file that imports the same file twice
    const mainContent = `
      %import("${importPath}");
      %import("${importPath}");
    `;
    const mainPath = path.join(tempDir, 'main.ncl');
    fs.writeFileSync(mainPath, mainContent);
    
    const ast = parseNcl(mainContent);
    const result = generate(ast, {}, mainPath);
    
    // Should contain the content twice (not cached at generation level)
    const lines = result.split('\n').filter(line => line.trim());
    expect(lines.filter(line => line.includes('worker_processes auto'))).toHaveLength(2);
  });
});