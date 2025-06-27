import { execSync } from "child_process";
import { beforeAll, describe, expect, it } from "vitest";
import {
	NginxValidator,
	validateNginxConfig,
} from "../src/validator/validator";

// Check Docker availability
let dockerAvailable = false;
try {
	execSync("docker --version", { stdio: "pipe" });
	execSync("docker ps", { stdio: "pipe" });
	dockerAvailable = true;
} catch {
	// Docker not available
}

describe("NginxValidator", () => {
	describe("Docker validation", () => {
		it.skipIf(!dockerAvailable)(
			"should validate a simple valid nginx config",
			async () => {
				const config = `
        worker_processes auto;
        
        events {
          worker_connections 1024;
        }
        
        http {
          server {
            listen 80;
            server_name example.com;
            
            location / {
              return 200 "Hello World";
            }
          }
        }
      `;

				const result = await validateNginxConfig(config, { useDocker: true });

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			},
		);

		it.skipIf(!dockerAvailable)(
			"should detect invalid nginx config",
			async () => {
				const config = `
        worker_processes auto;
        
        events {
          worker_connections 1024;
        }
        
        http {
          server {
            listen 80;
            server_name example.com;
            
            invalid_directive_that_does_not_exist;
            
            location / {
              return 200 "Hello World";
            }
          }
        }
      `;

				const result = await validateNginxConfig(config, { useDocker: true });

				expect(result.isValid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(0);
			},
		);

		it.skipIf(!dockerAvailable)("should handle syntax errors", async () => {
			const config = `
        worker_processes auto;
        
        events {
          worker_connections 1024;
        }
        
        http {
          server {
            listen 80;
            server_name example.com;
            
            location / {
              return 200 "Hello World"
              # Missing semicolon above
            }
          }
        }
      `;

			const result = await validateNginxConfig(config, { useDocker: true });

			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it.skipIf(!dockerAvailable)(
			"should validate location regex patterns",
			async () => {
				const config = `
        worker_processes auto;
        
        events {
          worker_connections 1024;
        }
        
        http {
          server {
            listen 80;
            server_name example.com;
            
            location ~ \\.php$ {
              return 200 "PHP file";
            }
            
            location ~ \\.(css|js|png|jpg)$ {
              return 200 "Static file";
            }
          }
        }
      `;

				const result = await validateNginxConfig(config, { useDocker: true });

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			},
		);
	});

	describe("Local nginx validation", () => {
		it("should handle missing nginx gracefully", async () => {
			const config = `
        worker_processes auto;
        
        events {
          worker_connections 1024;
        }
        
        http {
          server {
            listen 80;
            server_name example.com;
            
            location / {
              return 200 "Hello World";
            }
          }
        }
      `;

			const result = await validateNginxConfig(config, {
				useDocker: false,
				nginxCommand: "nginx-that-does-not-exist",
			});

			expect(result.isValid).toBe(false);
			expect(result.errors).toContain(
				"nginx is not installed or not in PATH: nginx-that-does-not-exist",
			);
			expect(result.warnings).toContain(
				"Consider installing nginx or using Docker validation (--use-docker)",
			);
		});
	});

	describe("Validator class", () => {
		it("should report validation method correctly", () => {
			const dockerValidator = new NginxValidator({
				useDocker: true,
				dockerImage: "nginx:latest",
			});
			expect(dockerValidator.getValidationMethod()).toBe(
				"Docker (nginx:latest)",
			);

			const localValidator = new NginxValidator({
				useDocker: false,
				nginxCommand: "nginx-custom",
			});
			expect(localValidator.getValidationMethod()).toBe(
				"Local nginx (nginx-custom)",
			);
		});

		it("should use default options", () => {
			const validator = new NginxValidator();
			expect(validator.getValidationMethod()).toBe("Docker (nginx:alpine)");
		});
	});

	describe("Output parsing", () => {
		it.skipIf(!dockerAvailable)(
			"should parse nginx warnings correctly",
			async () => {
				// This config might generate warnings in some nginx versions
				const config = `
        worker_processes auto;
        
        events {
          worker_connections 1024;
        }
        
        http {
          server {
            listen 80;
            server_name example.com;
            
            # This might generate warnings depending on nginx version
            client_max_body_size 1000M;
            
            location / {
              return 200 "Hello World";
            }
          }
        }
      `;

				const result = await validateNginxConfig(config, { useDocker: true });

				expect(result.isValid).toBe(true);
				expect(result.output).toBeTruthy();
			},
		);
	});
});
