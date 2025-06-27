/**
 * Main entry point for nginx-configuration-language library
 */

export { GeneratorOptions, generate } from "./generator/generator";
export * from "./parser/ast";
export { parse } from "./parser/parser";
export { Token, TokenType, tokenize } from "./parser/tokenizer";
