import { describe, expect, it } from "vitest";
import {
	ASTNode,
	type BlockNode,
	type ConfigNode,
	type DirectiveNode,
	type InlineDirectiveNode,
	LocationModifier,
	type LocationNode,
	type VariableAssignmentNode,
} from "../src/parser/ast";

describe("AST Node Types", () => {
	describe("DirectiveNode", () => {
		it("should represent a simple directive", () => {
			const directive: DirectiveNode = {
				type: "directive",
				name: "worker_processes",
				args: ["auto"],
				position: { line: 1, column: 1 },
			};

			expect(directive.type).toBe("directive");
			expect(directive.name).toBe("worker_processes");
			expect(directive.args).toEqual(["auto"]);
		});
	});

	describe("BlockNode", () => {
		it("should represent a block with directives", () => {
			const block: BlockNode = {
				type: "block",
				name: "server",
				args: [],
				children: [
					{
						type: "directive",
						name: "listen",
						args: ["80"],
						position: { line: 2, column: 3 },
					},
				],
				position: { line: 1, column: 1 },
			};

			expect(block.type).toBe("block");
			expect(block.name).toBe("server");
			expect(block.children).toHaveLength(1);
		});
	});

	describe("LocationNode", () => {
		it("should represent a location block", () => {
			const location: LocationNode = {
				type: "location",
				modifier: LocationModifier.None,
				paths: ["/api"],
				children: [],
				position: { line: 1, column: 1 },
			};

			expect(location.type).toBe("location");
			expect(location.modifier).toBe(LocationModifier.None);
			expect(location.paths).toEqual(["/api"]);
		});

		it("should represent a location with modifier", () => {
			const location: LocationNode = {
				type: "location",
				modifier: LocationModifier.Regex,
				paths: ["/\\.php$"],
				children: [],
				position: { line: 1, column: 1 },
			};

			expect(location.modifier).toBe(LocationModifier.Regex);
		});

		it("should support multiple paths (location in)", () => {
			const location: LocationNode = {
				type: "location",
				modifier: LocationModifier.None,
				paths: ["/api", "/v1", "/v2"],
				children: [],
				position: { line: 1, column: 1 },
			};

			expect(location.paths).toEqual(["/api", "/v1", "/v2"]);
		});
	});

	describe("VariableAssignmentNode", () => {
		it("should represent a variable assignment", () => {
			const assignment: VariableAssignmentNode = {
				type: "variable_assignment",
				name: "%common_headers",
				value: {
					type: "block",
					name: "",
					args: [],
					children: [
						{
							type: "directive",
							name: "add_header",
							args: ["X-Frame-Options", "SAMEORIGIN"],
							position: { line: 2, column: 3 },
						},
					],
					position: { line: 1, column: 20 },
				},
				position: { line: 1, column: 1 },
			};

			expect(assignment.type).toBe("variable_assignment");
			expect(assignment.name).toBe("%common_headers");
			expect((assignment.value as BlockNode).children).toHaveLength(1);
		});
	});

	describe("InlineDirectiveNode", () => {
		it("should represent an inline directive", () => {
			const inline: InlineDirectiveNode = {
				type: "inline",
				variableName: "%common_headers",
				position: { line: 5, column: 3 },
			};

			expect(inline.type).toBe("inline");
			expect(inline.variableName).toBe("%common_headers");
		});
	});

	describe("ConfigNode", () => {
		it("should represent the root configuration", () => {
			const config: ConfigNode = {
				type: "config",
				children: [
					{
						type: "directive",
						name: "worker_processes",
						args: ["auto"],
						position: { line: 1, column: 1 },
					},
					{
						type: "block",
						name: "http",
						args: [],
						children: [],
						position: { line: 3, column: 1 },
					},
				],
				position: { line: 1, column: 1 },
			};

			expect(config.type).toBe("config");
			expect(config.children).toHaveLength(2);
		});
	});
});
