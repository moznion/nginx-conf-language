#!/usr/bin/env node

/**
 * ncl-gen CLI tool for converting NCL files to nginx.conf
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { parse } from '../parser/parser';
import { generate } from '../generator/generator';

const program = new Command();

program
  .name('ncl-gen')
  .description('Convert nginx configuration language (NCL) files to nginx.conf')
  .version('1.0.0')
  .argument('<input>', 'Input NCL file path')
  .option('-o, --output <path>', 'Output file path (default: <input>.conf)')
  .option('--no-inline', 'Do not expand @inline directives')
  .option('--indent <string>', 'Indentation string (default: "  ")')
  .option('--stdout', 'Output to stdout instead of file')
  .action((input: string, options: any) => {
    try {
      // Resolve input path
      const inputPath = resolve(input);
      
      // Check if input file exists
      if (!existsSync(inputPath)) {
        console.error(`Error: Input file not found: ${inputPath}`);
        process.exit(1);
      }
      
      // Check file extension
      const ext = extname(inputPath);
      if (ext !== '.ncl') {
        console.warn(`Warning: Input file does not have .ncl extension: ${inputPath}`);
      }
      
      // Read input file
      const content = readFileSync(inputPath, 'utf-8');
      
      // Parse and generate
      const ast = parse(content);
      const output = generate(ast, {
        expandInline: options.inline !== false,
        indent: options.indent || '  '
      });
      
      // Determine output handling
      if (options.stdout) {
        // Output to stdout
        console.log(output);
      } else {
        // Determine output path
        let outputPath: string;
        if (options.output) {
          outputPath = resolve(options.output);
        } else {
          // Default: replace .ncl with .conf
          const dir = dirname(inputPath);
          const base = basename(inputPath, '.ncl');
          outputPath = resolve(dir, `${base}.conf`);
        }
        
        // Write output file
        writeFileSync(outputPath, output + '\n', 'utf-8');
        console.log(`Generated: ${outputPath}`);
      }
      
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('An unknown error occurred');
      }
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Show help if no arguments provided
if (process.argv.length < 3) {
  program.help();
}