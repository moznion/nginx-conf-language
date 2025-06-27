/**
 * Nginx configuration validator
 * Validates generated nginx.conf files using nginx -t command
 */

import { execSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface ValidationResult {
	isValid: boolean;
	output: string;
	errors: string[];
	warnings: string[];
}

export interface ValidatorOptions {
	useDocker?: boolean;
	nginxCommand?: string;
	dockerImage?: string;
	timeout?: number;
}

export class NginxValidator {
	private options: Required<ValidatorOptions>;

	constructor(options: ValidatorOptions = {}) {
		this.options = {
			useDocker: true,
			nginxCommand: "nginx",
			dockerImage: "nginx:alpine",
			timeout: 10000,
			...options,
		};
	}

	/**
	 * Validate nginx configuration content
	 */
	async validate(configContent: string): Promise<ValidationResult> {
		// Create temporary directory and file
		const tempDir = mkdtempSync(join(tmpdir(), "ncl-validation-"));
		const confPath = join(tempDir, "nginx.conf");

		try {
			writeFileSync(confPath, configContent, "utf-8");

			let result: ValidationResult;

			if (this.options.useDocker && (await this.isDockerAvailable())) {
				result = await this.validateWithDocker(confPath);
			} else {
				result = await this.validateWithLocalNginx(confPath);
			}

			return result;
		} finally {
			// Clean up temporary files
			rmSync(tempDir, { recursive: true, force: true });
		}
	}

	/**
	 * Check if Docker is available
	 */
	private async isDockerAvailable(): Promise<boolean> {
		try {
			execSync("docker --version", {
				stdio: "pipe",
				timeout: this.options.timeout,
			});
			execSync("docker ps", { stdio: "pipe", timeout: this.options.timeout });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Validate using Docker
	 */
	private async validateWithDocker(
		confPath: string,
	): Promise<ValidationResult> {
		try {
			const command = `docker run --rm -v "${confPath}:/etc/nginx/nginx.conf:ro" ${this.options.dockerImage} nginx -t 2>&1`;
			const output = execSync(command, {
				encoding: "utf-8",
				timeout: this.options.timeout,
			});

			return this.parseNginxOutput(output, true);
		} catch (error: any) {
			const output = (error.stdout || "") + (error.stderr || "");
			return this.parseNginxOutput(output, false);
		}
	}

	/**
	 * Validate using local nginx installation
	 */
	private async validateWithLocalNginx(
		confPath: string,
	): Promise<ValidationResult> {
		try {
			const command = `${this.options.nginxCommand} -t -c "${confPath}" 2>&1`;
			const output = execSync(command, {
				encoding: "utf-8",
				timeout: this.options.timeout,
			});

			return this.parseNginxOutput(output, true);
		} catch (error: any) {
			const output = (error.stdout || "") + (error.stderr || "");

			// Check if nginx is not found
			if (
				error.code === "ENOENT" ||
				error.errno === -2 ||
				(error.message && error.message.includes("ENOENT")) ||
				output.includes("not found") ||
				output.includes("command not found")
			) {
				return {
					isValid: false,
					output: `nginx command not found: ${this.options.nginxCommand}`,
					errors: [
						`nginx is not installed or not in PATH: ${this.options.nginxCommand}`,
					],
					warnings: [
						"Consider installing nginx or using Docker validation (--use-docker)",
					],
				};
			}

			return this.parseNginxOutput(output, false);
		}
	}

	/**
	 * Parse nginx -t output to extract errors and warnings
	 */
	private parseNginxOutput(output: string, isValid: boolean): ValidationResult {
		const lines = output.split("\n").filter((line) => line.trim());
		const errors: string[] = [];
		const warnings: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.includes("[emerg]") || trimmed.includes("[error]")) {
				errors.push(trimmed);
			} else if (trimmed.includes("[warn]")) {
				warnings.push(trimmed);
			}
		}

		// If nginx -t succeeded but we have errors, mark as invalid
		if (isValid && errors.length > 0) {
			isValid = false;
		}

		// If nginx -t failed but we don't have specific errors, add a generic one
		if (!isValid && errors.length === 0) {
			errors.push("nginx configuration test failed");
		}

		return {
			isValid,
			output,
			errors,
			warnings,
		};
	}

	/**
	 * Get validation method description
	 */
	getValidationMethod(): string {
		if (this.options.useDocker) {
			return `Docker (${this.options.dockerImage})`;
		} else {
			return `Local nginx (${this.options.nginxCommand})`;
		}
	}
}

/**
 * Convenience function to validate nginx configuration
 */
export async function validateNginxConfig(
	configContent: string,
	options?: ValidatorOptions,
): Promise<ValidationResult> {
	const validator = new NginxValidator(options);
	return validator.validate(configContent);
}
