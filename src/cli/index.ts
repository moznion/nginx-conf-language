#!/usr/bin/env node

/**
 * ncl-gen CLI tool for converting NCL files to nginx.conf
 */

import { Command } from "commander";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, extname, resolve } from "path";
import { generate } from "../generator/generator";
import { parse } from "../parser/parser";
import { validateNginxConfig } from "../validator/validator";

const program = new Command();

program
	.name("ncl-gen")
	.description("Convert nginx configuration language (NCL) files to nginx.conf")
	.version("1.0.0")
	.argument("<input>", "Input NCL file path")
	.option("-o, --output <path>", "Output file path (default: <input>.conf)")
	.option("--no-inline", "Do not expand @inline directives")
	.option("--indent <string>", 'Indentation string (default: "  ")')
	.option("--stdout", "Output to stdout instead of file")
	.option("--validate", "Validate generated nginx configuration")
	.option("--validate-only", "Only validate, do not generate output file")
	.option("--no-docker", "Use local nginx instead of Docker for validation")
	.option(
		"--nginx-cmd <command>",
		'Nginx command for local validation (default: "nginx")',
	)
	.option(
		"--docker-image <image>",
		'Docker image for validation (default: "nginx:alpine")',
	)
	.action(async (input: string, options: any) => {
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
			if (ext !== ".ncl") {
				console.warn(
					`Warning: Input file does not have .ncl extension: ${inputPath}`,
				);
			}

			// Read input file
			const content = readFileSync(inputPath, "utf-8");

			// Parse and generate
			const ast = parse(content);
			const output = generate(
				ast,
				{
					expandInline: options.inline !== false,
					indent: options.indent || "  ",
				},
				inputPath,
			);

			// Validate if requested
			if (options.validate || options.validateOnly) {
				console.log("Validating nginx configuration...");

				const validationResult = await validateNginxConfig(output, {
					useDocker: options.docker !== false,
					nginxCommand: options.nginxCmd || "nginx",
					dockerImage: options.dockerImage || "nginx:alpine",
				});

				if (validationResult.isValid) {
					console.log("✅ Configuration is valid");
					if (validationResult.warnings.length > 0) {
						console.log("\n⚠️  Warnings:");
						validationResult.warnings.forEach((warning) => {
							console.log(`  ${warning}`);
						});
					}
				} else {
					console.log("❌ Configuration is invalid");
					if (validationResult.errors.length > 0) {
						console.log("\n🚨 Errors:");
						validationResult.errors.forEach((error) => {
							console.log(`  ${error}`);
						});
					}
					if (validationResult.warnings.length > 0) {
						console.log("\n⚠️  Warnings:");
						validationResult.warnings.forEach((warning) => {
							console.log(`  ${warning}`);
						});
					}

					if (options.validateOnly) {
						process.exit(1);
					}
				}

				if (validationResult.output && validationResult.output.trim()) {
					console.log("\n📋 Full nginx output:");
					console.log(validationResult.output);
				}

				console.log(""); // Empty line for better formatting
			}

			// Skip file generation if validate-only mode
			if (options.validateOnly) {
				return;
			}

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
					const base = basename(inputPath, ".ncl");
					outputPath = resolve(dir, `${base}.conf`);
				}

				// Write output file
				writeFileSync(outputPath, output + "\n", "utf-8");
				console.log(`Generated: ${outputPath}`);
			}
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Error: ${error.message}`);
			} else {
				console.error("An unknown error occurred");
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
