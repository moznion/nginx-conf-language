/**
 * Main entry point for nginx-configuration-language library
 */

export { parse } from './parser/parser';
export { generate, GeneratorOptions } from './generator/generator';
export { tokenize, Token, TokenType } from './parser/tokenizer';
export * from './parser/ast';