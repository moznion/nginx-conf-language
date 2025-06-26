/**
 * Tokenizer for nginx configuration language
 */

export enum TokenType {
  // Literals
  Identifier = 'IDENTIFIER',
  Number = 'NUMBER',
  String = 'STRING',
  
  // Keywords
  Location = 'LOCATION',
  In = 'IN',
  
  // Special tokens
  Variable = 'VARIABLE',
  Inline = 'INLINE',
  LocationModifier = 'LOCATION_MODIFIER',
  
  // Delimiters
  LeftBrace = 'LEFT_BRACE',
  RightBrace = 'RIGHT_BRACE',
  LeftBracket = 'LEFT_BRACKET',
  RightBracket = 'RIGHT_BRACKET',
  LeftParen = 'LEFT_PAREN',
  RightParen = 'RIGHT_PAREN',
  Semicolon = 'SEMICOLON',
  Comma = 'COMMA',
  Equals = 'EQUALS',
  
  // End of file
  EOF = 'EOF'
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Tokenizer {
  private input: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  tokenize(): Token[] {
    while (this.position < this.input.length) {
      this.skipWhitespaceAndComments();
      
      if (this.position >= this.input.length) {
        break;
      }

      const token = this.readToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      line: this.line,
      column: this.column
    });

    return this.tokens;
  }

  private skipWhitespaceAndComments(): void {
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      // Skip whitespace
      if (/\s/.test(char)) {
        if (char === '\n') {
          this.line++;
          this.column = 1;
        } else {
          this.column++;
        }
        this.position++;
        continue;
      }
      
      // Skip comments
      if (char === '#') {
        while (this.position < this.input.length && this.input[this.position] !== '\n') {
          this.position++;
        }
        continue;
      }
      
      break;
    }
  }

  private readToken(): Token | null {
    const startColumn = this.column;
    const char = this.input[this.position];

    // Single character tokens
    switch (char) {
      case '{':
        this.position++;
        this.column++;
        return { type: TokenType.LeftBrace, value: '{', line: this.line, column: startColumn };
      case '}':
        this.position++;
        this.column++;
        return { type: TokenType.RightBrace, value: '}', line: this.line, column: startColumn };
      case '[':
        this.position++;
        this.column++;
        return { type: TokenType.LeftBracket, value: '[', line: this.line, column: startColumn };
      case ']':
        this.position++;
        this.column++;
        return { type: TokenType.RightBracket, value: ']', line: this.line, column: startColumn };
      case ';':
        this.position++;
        this.column++;
        return { type: TokenType.Semicolon, value: ';', line: this.line, column: startColumn };
      case ',':
        this.position++;
        this.column++;
        return { type: TokenType.Comma, value: ',', line: this.line, column: startColumn };
      case '=':
        this.position++;
        this.column++;
        return { type: TokenType.Equals, value: '=', line: this.line, column: startColumn };
      case '(':
        this.position++;
        this.column++;
        return { type: TokenType.LeftParen, value: '(', line: this.line, column: startColumn };
      case ')':
        this.position++;
        this.column++;
        return { type: TokenType.RightParen, value: ')', line: this.line, column: startColumn };
    }

    // Strings
    if (char === '"' || char === "'") {
      return this.readString(char);
    }

    // Variables
    if (char === '$') {
      return this.readVariable();
    }

    // @inline directive
    if (char === '@') {
      return this.readInline();
    }

    // Location modifiers
    if (this.isLocationModifier()) {
      return this.readLocationModifier();
    }

    // Numbers
    if (/\d/.test(char)) {
      return this.readNumber();
    }

    // Identifiers and keywords
    if (this.isIdentifierStart(char)) {
      return this.readIdentifier();
    }

    // Unknown character - include it in identifier
    return this.readIdentifier();
  }

  private readString(quote: string): Token {
    const startColumn = this.column;
    this.position++; // Skip opening quote
    this.column++;
    
    let value = '';
    while (this.position < this.input.length && this.input[this.position] !== quote) {
      if (this.input[this.position] === '\\' && this.position + 1 < this.input.length) {
        // Handle escape sequences
        this.position++;
        this.column++;
        value += this.input[this.position];
      } else {
        value += this.input[this.position];
      }
      
      if (this.input[this.position] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.position++;
    }
    
    if (this.position >= this.input.length) {
      throw new Error(`Unterminated string at line ${this.line}, column ${startColumn}`);
    }
    
    this.position++; // Skip closing quote
    this.column++;
    
    return { type: TokenType.String, value, line: this.line, column: startColumn };
  }

  private readVariable(): Token {
    const startColumn = this.column;
    let value = '$';
    this.position++;
    this.column++;
    
    while (this.position < this.input.length && this.isIdentifierPart(this.input[this.position])) {
      value += this.input[this.position];
      this.position++;
      this.column++;
    }
    
    return { type: TokenType.Variable, value, line: this.line, column: startColumn };
  }

  private readInline(): Token {
    const startColumn = this.column;
    
    // Check if it's @inline
    if (this.input.substring(this.position, this.position + 7) === '@inline') {
      this.position += 7;
      this.column += 7;
      return { type: TokenType.Inline, value: '@inline', line: this.line, column: startColumn };
    }
    
    // Otherwise, treat @ as part of identifier
    return this.readIdentifier();
  }

  private isLocationModifier(): boolean {
    const char = this.input[this.position];
    if (char === '~') {
      // Check for ~*
      if (this.position + 1 < this.input.length && this.input[this.position + 1] === '*') {
        return true;
      }
      return true;
    }
    if (char === '=' || char === '^') {
      // Check for ^~
      if (char === '^' && this.position + 1 < this.input.length && this.input[this.position + 1] === '~') {
        return true;
      }
      // Single = is location modifier only in location context
      // This is handled by parser context
      return false;
    }
    return false;
  }

  private readLocationModifier(): Token {
    const startColumn = this.column;
    let value = '';
    
    if (this.input[this.position] === '~') {
      value = '~';
      this.position++;
      this.column++;
      
      if (this.position < this.input.length && this.input[this.position] === '*') {
        value += '*';
        this.position++;
        this.column++;
      }
    } else if (this.input[this.position] === '^' && 
               this.position + 1 < this.input.length && 
               this.input[this.position + 1] === '~') {
      value = '^~';
      this.position += 2;
      this.column += 2;
    }
    
    return { type: TokenType.LocationModifier, value, line: this.line, column: startColumn };
  }

  private readNumber(): Token {
    const startColumn = this.column;
    let value = '';
    
    while (this.position < this.input.length && /\d/.test(this.input[this.position])) {
      value += this.input[this.position];
      this.position++;
      this.column++;
    }
    
    return { type: TokenType.Number, value, line: this.line, column: startColumn };
  }

  private readIdentifier(): Token {
    const startColumn = this.column;
    let value = '';
    
    // Read until we hit whitespace or delimiter
    while (this.position < this.input.length) {
      const char = this.input[this.position];
      if (/\s/.test(char) || 
          char === '{' || char === '}' || 
          char === '[' || char === ']' || 
          char === ';' || char === ',' || 
          char === '=' ||
          char === '"' || char === "'" ||
          char === '(' || char === ')') {
        break;
      }
      value += char;
      this.position++;
      this.column++;
    }
    
    // Check for keywords
    if (value === 'location') {
      return { type: TokenType.Location, value, line: this.line, column: startColumn };
    }
    if (value === 'in') {
      return { type: TokenType.In, value, line: this.line, column: startColumn };
    }
    
    return { type: TokenType.Identifier, value, line: this.line, column: startColumn };
  }

  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isIdentifierPart(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }
}

export function tokenize(input: string): Token[] {
  const tokenizer = new Tokenizer(input);
  return tokenizer.tokenize();
}