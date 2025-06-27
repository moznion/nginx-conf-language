import { describe, it, expect } from 'vitest';
import { tokenize, Token, TokenType } from '../src/parser/tokenizer';

describe('Tokenizer', () => {
  describe('Basic tokens', () => {
    it('should tokenize simple directive', () => {
      const input = 'worker_processes auto;';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Identifier, value: 'worker_processes', line: 1, column: 1 },
        { type: TokenType.Identifier, value: 'auto', line: 1, column: 18 },
        { type: TokenType.Semicolon, value: ';', line: 1, column: 22 },
        { type: TokenType.EOF, value: '', line: 1, column: 23 }
      ]);
    });

    it('should tokenize block structure', () => {
      const input = 'http {\n  server_name example.com;\n}';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Identifier, value: 'http', line: 1, column: 1 },
        { type: TokenType.LeftBrace, value: '{', line: 1, column: 6 },
        { type: TokenType.Identifier, value: 'server_name', line: 2, column: 3 },
        { type: TokenType.Identifier, value: 'example.com', line: 2, column: 15 },
        { type: TokenType.Semicolon, value: ';', line: 2, column: 26 },
        { type: TokenType.RightBrace, value: '}', line: 3, column: 1 },
        { type: TokenType.EOF, value: '', line: 3, column: 2 }
      ]);
    });

    it('should tokenize quoted strings', () => {
      const input = 'add_header "X-Content-Type" \'text/html\';';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Identifier, value: 'add_header', line: 1, column: 1 },
        { type: TokenType.String, value: 'X-Content-Type', line: 1, column: 12 },
        { type: TokenType.String, value: 'text/html', line: 1, column: 29 },
        { type: TokenType.Semicolon, value: ';', line: 1, column: 40 },
        { type: TokenType.EOF, value: '', line: 1, column: 41 }
      ]);
    });

    it('should handle comments', () => {
      const input = '# This is a comment\nworker_processes 1; # inline comment';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Identifier, value: 'worker_processes', line: 2, column: 1 },
        { type: TokenType.Number, value: '1', line: 2, column: 18 },
        { type: TokenType.Semicolon, value: ';', line: 2, column: 19 },
        { type: TokenType.EOF, value: '', line: 2, column: 21 }
      ]);
    });
  });

  describe('Location syntax', () => {
    it('should tokenize location with modifier', () => {
      const input = 'location ~ /api { }';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Location, value: 'location', line: 1, column: 1 },
        { type: TokenType.LocationModifier, value: '~', line: 1, column: 10 },
        { type: TokenType.Identifier, value: '/api', line: 1, column: 12 },
        { type: TokenType.LeftBrace, value: '{', line: 1, column: 17 },
        { type: TokenType.RightBrace, value: '}', line: 1, column: 19 },
        { type: TokenType.EOF, value: '', line: 1, column: 20 }
      ]);
    });

    it('should tokenize location in syntax', () => {
      const input = 'location in ["/api", "=/exact", "~/regex"] { }';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Location, value: 'location', line: 1, column: 1 },
        { type: TokenType.In, value: 'in', line: 1, column: 10 },
        { type: TokenType.LeftBracket, value: '[', line: 1, column: 13 },
        { type: TokenType.String, value: '/api', line: 1, column: 14 },
        { type: TokenType.Comma, value: ',', line: 1, column: 20 },
        { type: TokenType.String, value: '=/exact', line: 1, column: 22 },
        { type: TokenType.Comma, value: ',', line: 1, column: 31 },
        { type: TokenType.String, value: '~/regex', line: 1, column: 33 },
        { type: TokenType.RightBracket, value: ']', line: 1, column: 42 },
        { type: TokenType.LeftBrace, value: '{', line: 1, column: 44 },
        { type: TokenType.RightBrace, value: '}', line: 1, column: 46 },
        { type: TokenType.EOF, value: '', line: 1, column: 47 }
      ]);
    });
  });

  describe('Variable and inline syntax', () => {
    it('should tokenize variable assignment', () => {
      const input = '%common_headers = {\n  add_header X-Frame-Options SAMEORIGIN;\n};';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Variable, value: '%common_headers', line: 1, column: 1 },
        { type: TokenType.Equals, value: '=', line: 1, column: 17 },
        { type: TokenType.LeftBrace, value: '{', line: 1, column: 19 },
        { type: TokenType.Identifier, value: 'add_header', line: 2, column: 3 },
        { type: TokenType.Identifier, value: 'X-Frame-Options', line: 2, column: 14 },
        { type: TokenType.Identifier, value: 'SAMEORIGIN', line: 2, column: 30 },
        { type: TokenType.Semicolon, value: ';', line: 2, column: 40 },
        { type: TokenType.RightBrace, value: '}', line: 3, column: 1 },
        { type: TokenType.Semicolon, value: ';', line: 3, column: 2 },
        { type: TokenType.EOF, value: '', line: 3, column: 3 }
      ]);
    });

    it('should tokenize inline directive', () => {
      const input = '%inline(%common_headers);';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Inline, value: '%inline', line: 1, column: 1 },
        { type: TokenType.LeftParen, value: '(', line: 1, column: 8 },
        { type: TokenType.Variable, value: '%common_headers', line: 1, column: 9 },
        { type: TokenType.RightParen, value: ')', line: 1, column: 24 },
        { type: TokenType.Semicolon, value: ';', line: 1, column: 25 },
        { type: TokenType.EOF, value: '', line: 1, column: 26 }
      ]);
    });
  });

  describe('Numbers and special characters', () => {
    it('should tokenize numbers', () => {
      const input = 'listen 80; worker_connections 1024;';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Identifier, value: 'listen', line: 1, column: 1 },
        { type: TokenType.Number, value: '80', line: 1, column: 8 },
        { type: TokenType.Semicolon, value: ';', line: 1, column: 10 },
        { type: TokenType.Identifier, value: 'worker_connections', line: 1, column: 12 },
        { type: TokenType.Number, value: '1024', line: 1, column: 31 },
        { type: TokenType.Semicolon, value: ';', line: 1, column: 35 },
        { type: TokenType.EOF, value: '', line: 1, column: 36 }
      ]);
    });

    it('should handle regex patterns', () => {
      const input = 'location ~ \\.php$ { }';
      const tokens = tokenize(input);

      expect(tokens).toEqual([
        { type: TokenType.Location, value: 'location', line: 1, column: 1 },
        { type: TokenType.LocationModifier, value: '~', line: 1, column: 10 },
        { type: TokenType.Identifier, value: '\\.php$', line: 1, column: 12 },
        { type: TokenType.LeftBrace, value: '{', line: 1, column: 19 },
        { type: TokenType.RightBrace, value: '}', line: 1, column: 21 },
        { type: TokenType.EOF, value: '', line: 1, column: 22 }
      ]);
    });
  });

  describe('Error handling', () => {
    it('should handle unterminated strings', () => {
      const input = 'server_name "example.com';
      expect(() => tokenize(input)).toThrow('Unterminated string');
    });

    it('should handle invalid characters', () => {
      const input = 'server_name example.com!;';
      const tokens = tokenize(input);
      
      expect(tokens).toContainEqual(
        expect.objectContaining({ 
          type: TokenType.Identifier, 
          value: 'example.com!' 
        })
      );
    });
  });
});