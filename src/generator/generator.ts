/**
 * Code generator for nginx configuration language
 */

import * as fs from "fs";
import * as path from "path";
import {
	type ASTNode,
	type BlockNode,
	type ConfigNode,
	type DirectiveNode,
	type EnvironmentVariableNode,
	type ImportNode,
	type InlineDirectiveNode,
	LocationModifier,
	type LocationNode,
	type VariableAssignmentNode,
} from "../parser/ast";
import { Parser } from "../parser/parser";
import { tokenize } from "../parser/tokenizer";

export interface GeneratorOptions {
	indent?: string;
	expandInline?: boolean;
}

export class Generator {
	private options: Required<GeneratorOptions>;
	private indentLevel: number = 0;
	private variables: Map<string, BlockNode> = new Map();
	private importStack: string[] = [];
	private processedFiles: Map<string, ConfigNode> = new Map();
	private currentFile: string = "";

	constructor(options: GeneratorOptions = {}) {
		this.options = {
			indent: options.indent || "  ",
			expandInline: options.expandInline || false,
		};
	}

	generate(ast: ConfigNode, filePath: string = ""): string {
		this.currentFile = filePath;

		// First pass: collect all variable definitions
		this.collectVariables(ast);

		// Second pass: generate output
		return this.generateNode(ast).trim();
	}

	private collectVariables(node: ASTNode): void {
		if (node.type === "variable_assignment") {
			const varNode = node as VariableAssignmentNode;
			this.variables.set(varNode.name, varNode.value);
		} else if ("children" in node && Array.isArray(node.children)) {
			for (const child of node.children) {
				this.collectVariables(child);
			}
		}
	}

	private generateNode(node: ASTNode): string {
		switch (node.type) {
			case "config":
				return this.generateConfig(node as ConfigNode);
			case "directive":
				return this.generateDirective(node as DirectiveNode);
			case "block":
				return this.generateBlock(node as BlockNode);
			case "location":
				return this.generateLocation(node as LocationNode);
			case "variable_assignment":
				// Variable assignments are not output
				return "";
			case "inline":
				return this.generateInline(node as InlineDirectiveNode);
			case "env_var":
				return this.generateEnvironmentVariable(
					node as EnvironmentVariableNode,
				);
			case "import":
				return this.generateImport(node as ImportNode);
			default:
				throw new Error(`Unknown node type: ${(node as any).type}`);
		}
	}

	private generateConfig(node: ConfigNode): string {
		const lines: string[] = [];

		for (const child of node.children) {
			const generated = this.generateNode(child);
			if (generated) {
				lines.push(generated);
			}
		}

		return lines.join("\n");
	}

	private generateDirective(node: DirectiveNode): string {
		const indent = this.getIndent();
		const args = node.args.map((arg) => this.quoteIfNeeded(arg)).join(" ");
		return `${indent}${node.name}${args ? " " + args : ""};`;
	}

	private generateBlock(node: BlockNode): string {
		const indent = this.getIndent();
		const args = node.args.map((arg) => this.quoteIfNeeded(arg)).join(" ");
		const header = `${indent}${node.name}${args ? " " + args : ""} {`;

		this.indentLevel++;
		const childrenLines: string[] = [];

		for (const child of node.children) {
			const generated = this.generateNode(child);
			if (generated) {
				childrenLines.push(generated);
			}
		}

		this.indentLevel--;

		const footer = `${indent}}`;

		return [header, ...childrenLines, footer].join("\n");
	}

	private generateLocation(node: LocationNode): string {
		// If multiple paths, expand into multiple location blocks
		if (node.paths.length > 1) {
			const blocks: string[] = [];

			for (const path of node.paths) {
				const singleLocation: LocationNode = {
					...node,
					paths: [path],
				};
				blocks.push(this.generateSingleLocation(singleLocation));
			}

			return blocks.join("\n");
		}

		return this.generateSingleLocation(node);
	}

	private generateSingleLocation(node: LocationNode): string {
		const indent = this.getIndent();
		let path = node.paths[0];
		let modifier = node.modifier;

		// Extract modifier from path if present
		if (path.startsWith("=")) {
			modifier = LocationModifier.Exact;
			path = path.substring(1);
		} else if (path.startsWith("~*")) {
			modifier = LocationModifier.RegexCaseInsensitive;
			path = path.substring(2);
		} else if (path.startsWith("~")) {
			modifier = LocationModifier.Regex;
			path = path.substring(1);
		} else if (path.startsWith("^~")) {
			modifier = LocationModifier.Prefix;
			path = path.substring(2);
		}

		const modifierStr = modifier ? modifier + " " : "";
		const header = `${indent}location ${modifierStr}${this.quoteIfNeeded(path)} {`;

		this.indentLevel++;
		const childrenLines: string[] = [];

		for (const child of node.children) {
			const generated = this.generateNode(child);
			if (generated) {
				childrenLines.push(generated);
			}
		}

		this.indentLevel--;

		const footer = `${indent}}`;

		return [header, ...childrenLines, footer].join("\n");
	}

	private generateInline(node: InlineDirectiveNode): string {
		if (!this.options.expandInline) {
			// If not expanding, output the original %inline directive
			const indent = this.getIndent();
			return `${indent}%inline(${node.variableName});`;
		}

		// Expand the inline directive
		const varBlock = this.variables.get(node.variableName);
		if (!varBlock) {
			throw new Error(`Undefined variable: ${node.variableName}`);
		}

		// Generate the contents of the variable block without extra indentation
		const lines: string[] = [];

		for (const child of varBlock.children) {
			const generated = this.generateNode(child);
			if (generated) {
				lines.push(generated);
			}
		}

		return lines.join("\n");
	}

	private generateEnvironmentVariable(node: EnvironmentVariableNode): string {
		// Resolve environment variable at generation time
		const envValue = process.env[node.variableName];

		if (envValue !== undefined) {
			return envValue;
		} else if (node.defaultValue !== undefined) {
			return node.defaultValue;
		} else {
			throw new Error(
				`Environment variable ${node.variableName} is not set and no default value provided`,
			);
		}
	}

	private getIndent(): string {
		return this.options.indent.repeat(this.indentLevel);
	}

	private quoteIfNeeded(value: string): string {
		// If already quoted with double or single quotes, return as is
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			return value;
		}

		// Check if value contains spaces or special characters that need quoting
		if (/\s|[{}();,]/.test(value)) {
			// Quote it with double quotes
			return `"${value}"`;
		}

		return value;
	}

	private generateImport(node: ImportNode): string {
		const importPath = this.resolveImportPath(node.path);

		// Check for circular dependency
		if (this.importStack.includes(importPath)) {
			const cycle = [...this.importStack, importPath].join(" -> ");
			throw new Error(`Circular dependency detected: ${cycle}`);
		}

		// Check if file has already been processed
		if (this.processedFiles.has(importPath)) {
			const cachedAst = this.processedFiles.get(importPath)!;
			return this.generateImportedContent(cachedAst, importPath);
		}

		// Read and parse the imported file
		if (!fs.existsSync(importPath)) {
			throw new Error(`Import file not found: ${importPath}`);
		}

		const content = fs.readFileSync(importPath, "utf-8");
		const tokens = tokenize(content);
		const parser = new Parser(tokens);
		const importedAst = parser.parse();

		// Cache the parsed AST
		this.processedFiles.set(importPath, importedAst);

		return this.generateImportedContent(importedAst, importPath);
	}

	private generateImportedContent(ast: ConfigNode, filePath: string): string {
		// Push current file to import stack
		this.importStack.push(filePath);

		try {
			// Collect variables from imported file
			this.collectVariables(ast);

			// Generate content from imported AST (excluding variable assignments)
			const lines: string[] = [];
			for (const child of ast.children) {
				if (child.type !== "variable_assignment") {
					const generated = this.generateNode(child);
					if (generated) {
						lines.push(generated);
					}
				}
			}

			return lines.join("\n");
		} finally {
			// Pop from import stack
			this.importStack.pop();
		}
	}

	private resolveImportPath(importPath: string): string {
		if (path.isAbsolute(importPath)) {
			return importPath;
		}

		if (this.currentFile) {
			return path.resolve(path.dirname(this.currentFile), importPath);
		}

		return path.resolve(importPath);
	}
}

export function generate(
	ast: ConfigNode,
	options?: GeneratorOptions,
	filePath?: string,
): string {
	const generator = new Generator(options);
	return generator.generate(ast, filePath || "");
}
