/**
 * Parser for nginx configuration language
 */

import { Token, TokenType, tokenize } from './tokenizer';
import {
  ASTNode,
  ConfigNode,
  DirectiveNode,
  BlockNode,
  LocationNode,
  LocationModifier,
  VariableAssignmentNode,
  InlineDirectiveNode,
  Position
} from './ast';

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ConfigNode {
    const children: ASTNode[] = [];
    const startPos = this.getCurrentPosition();

    while (!this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) {
        children.push(node);
      }
    }

    return {
      type: 'config',
      children,
      position: startPos
    };
  }

  private parseStatement(): ASTNode | null {
    // Skip EOF token
    if (this.check(TokenType.EOF)) {
      return null;
    }

    // Variable assignment (only at top level with = following)
    if (this.check(TokenType.Variable)) {
      const nextToken = this.peekNext();
      if (nextToken && nextToken.type === TokenType.Equals) {
        return this.parseVariableAssignment();
      }
      // Otherwise, treat as a regular identifier/argument
      return this.parseDirective();
    }

    // @inline directive
    if (this.check(TokenType.Inline)) {
      return this.parseInlineDirective();
    }

    // Location block
    if (this.check(TokenType.Location)) {
      return this.parseLocation();
    }

    // Block or directive
    if (this.check(TokenType.Identifier)) {
      const identifier = this.peek();
      
      // Special handling for 'if' blocks
      if (identifier.value === 'if') {
        return this.parseIfBlock();
      }
      
      const nextToken = this.peekNext();

      // Check if it's a block (has opening brace)
      if (nextToken && (nextToken.type === TokenType.LeftBrace || 
          (this.peekAhead(2) && this.peekAhead(2)!.type === TokenType.LeftBrace))) {
        return this.parseBlock();
      }

      // Otherwise it's a directive
      return this.parseDirective();
    }

    throw this.error(`Unexpected token: ${this.peek().value}`);
  }

  private parseVariableAssignment(): VariableAssignmentNode {
    const startPos = this.getCurrentPosition();
    const variable = this.advance();
    
    if (!this.consume(TokenType.Equals, 'Expected = after variable')) {
      throw this.error('Expected = after variable');
    }

    if (!this.check(TokenType.LeftBrace)) {
      throw this.error('Expected { after variable assignment');
    }

    const value = this.parseBlockBody('');

    if (!this.consume(TokenType.Semicolon, 'Expected ; after variable assignment')) {
      throw this.error('Expected ; after variable assignment');
    }

    return {
      type: 'variable_assignment',
      name: variable.value,
      value,
      position: startPos
    };
  }

  private parseInlineDirective(): InlineDirectiveNode {
    const startPos = this.getCurrentPosition();
    this.advance(); // consume @inline

    if (!this.check(TokenType.Variable)) {
      throw this.error('Expected variable after @inline');
    }

    const variable = this.advance();

    return {
      type: 'inline',
      variableName: variable.value,
      position: startPos
    };
  }

  private parseLocation(): LocationNode {
    const startPos = this.getCurrentPosition();
    this.advance(); // consume 'location'

    let modifier = LocationModifier.None;
    let paths: string[] = [];

    // Check for 'in' keyword
    if (this.check(TokenType.In)) {
      this.advance(); // consume 'in'
      
      if (!this.consume(TokenType.LeftBracket, 'Expected [ after location in')) {
        throw this.error('Expected [ after location in');
      }

      // Parse path list
      while (!this.check(TokenType.RightBracket) && !this.isAtEnd()) {
        if (!this.check(TokenType.String)) {
          throw this.error('Expected string in location path list');
        }
        
        paths.push(this.advance().value);

        if (this.check(TokenType.Comma)) {
          this.advance();
        } else if (!this.check(TokenType.RightBracket)) {
          throw this.error('Expected , or ] in location path list');
        }
      }

      if (!this.consume(TokenType.RightBracket, 'Expected ] after location paths')) {
        throw this.error('Expected ] after location paths');
      }
    } else {
      // Parse modifier if present
      if (this.check(TokenType.LocationModifier)) {
        const modToken = this.advance();
        modifier = this.parseLocationModifier(modToken.value);
      } else if (this.check(TokenType.Equals)) {
        // Handle = as location modifier
        this.advance();
        modifier = LocationModifier.Exact;
      }

      // Parse single path
      if (!this.check(TokenType.Identifier) && !this.check(TokenType.String)) {
        throw this.error('Expected path after location');
      }
      
      paths.push(this.advance().value);
    }

    // Parse block body
    if (!this.check(TokenType.LeftBrace)) {
      throw this.error('Expected { after location');
    }

    const children = this.parseBlockChildren();

    return {
      type: 'location',
      modifier,
      paths,
      children,
      position: startPos
    };
  }

  private parseLocationModifier(value: string): LocationModifier {
    switch (value) {
      case '=': return LocationModifier.Exact;
      case '~': return LocationModifier.Regex;
      case '~*': return LocationModifier.RegexCaseInsensitive;
      case '^~': return LocationModifier.Prefix;
      default: return LocationModifier.None;
    }
  }

  private parseBlock(): BlockNode {
    const startPos = this.getCurrentPosition();
    const name = this.advance().value;
    const args: string[] = [];

    // Parse block arguments
    while (!this.check(TokenType.LeftBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.Identifier) || this.check(TokenType.String) || this.check(TokenType.Number) || this.check(TokenType.Variable)) {
        args.push(this.advance().value);
      } else {
        break;
      }
    }

    if (!this.check(TokenType.LeftBrace)) {
      throw this.error('Expected { after block name');
    }

    const children = this.parseBlockChildren();

    return {
      type: 'block',
      name,
      args,
      children,
      position: startPos
    };
  }

  private parseBlockBody(name: string): BlockNode {
    const startPos = this.getCurrentPosition();
    const children = this.parseBlockChildren();

    return {
      type: 'block',
      name,
      args: [],
      children,
      position: startPos
    };
  }

  private parseBlockChildren(): ASTNode[] {
    if (!this.consume(TokenType.LeftBrace, 'Expected {')) {
      throw this.error('Expected {');
    }

    const children: ASTNode[] = [];

    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) {
        children.push(node);
      }
    }

    if (!this.consume(TokenType.RightBrace, 'Expected }')) {
      throw this.error('Expected }');
    }

    return children;
  }

  private parseIfBlock(): BlockNode {
    const startPos = this.getCurrentPosition();
    this.advance(); // consume 'if'
    
    const args: string[] = [];
    let inParens = false;
    
    // Check for opening parenthesis
    if (this.check(TokenType.LeftParen)) {
      this.advance();
      inParens = true;
    }
    
    // Collect everything until { or )
    while (!this.check(TokenType.LeftBrace) && !this.isAtEnd()) {
      if (inParens && this.check(TokenType.RightParen)) {
        this.advance();
        break;
      }
      
      // Accept any token as part of the condition
      args.push(this.advance().value);
    }
    
    const children = this.parseBlockChildren();
    
    return {
      type: 'block',
      name: 'if',
      args,
      children,
      position: startPos
    };
  }

  private parseDirective(): DirectiveNode {
    const startPos = this.getCurrentPosition();
    const name = this.advance().value;
    const args: string[] = [];
    const directiveLine = startPos.line;

    // Parse directive arguments
    while (!this.check(TokenType.Semicolon) && !this.isAtEnd()) {
      const currentToken = this.peek();
      
      // If we encounter a token on a different line that could be a directive name,
      // stop parsing arguments and expect a semicolon
      if (currentToken.line > directiveLine && this.check(TokenType.Identifier)) {
        break;
      }
      
      if (this.check(TokenType.Identifier) || this.check(TokenType.String) || this.check(TokenType.Number) || this.check(TokenType.Variable)) {
        args.push(this.advance().value);
      } else if (this.check(TokenType.Equals)) {
        // Handle special syntax like =404
        const equalsToken = this.advance();
        if (this.check(TokenType.Number) || this.check(TokenType.Identifier)) {
          args.push(equalsToken.value + this.advance().value);
        } else {
          args.push(equalsToken.value);
        }
      } else if (this.check(TokenType.LeftBrace) || this.check(TokenType.RightBrace)) {
        // Hit a brace, likely missing semicolon
        throw this.error('Expected ; after directive');
      } else {
        break;
      }
    }

    if (!this.consume(TokenType.Semicolon, 'Expected ;')) {
      throw this.error('Expected ; after directive');
    }

    return {
      type: 'directive',
      name,
      args,
      position: startPos
    };
  }

  // Helper methods
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private consume(type: TokenType, _message: string): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token | null {
    if (this.current + 1 < this.tokens.length) {
      return this.tokens[this.current + 1];
    }
    return null;
  }

  private peekAhead(n: number): Token | null {
    if (this.current + n < this.tokens.length) {
      return this.tokens[this.current + n];
    }
    return null;
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private getCurrentPosition(): Position {
    const token = this.peek();
    return { line: token.line, column: token.column };
  }

  private error(message: string): Error {
    const token = this.peek();
    return new Error(`${message} at line ${token.line}, column ${token.column}`);
  }
}

export function parse(input: string): ConfigNode {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parse();
}