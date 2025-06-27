import { execSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Check Docker availability
let dockerAvailable = false;
try {
	execSync("docker --version", { stdio: "pipe" });
	execSync("docker ps", { stdio: "pipe" });
	dockerAvailable = true;
} catch {
	// Docker not available
}

describe("CLI Validation Features", () => {
	let tempDir: string;

	beforeAll(() => {
		tempDir = mkdtempSync(join(tmpdir(), "ncl-cli-test-"));
	});

	afterAll(() => {
		if (tempDir) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it.skipIf(!dockerAvailable)(
		"should validate NCL file with --validate option",
		() => {
			const nclContent = `
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

			const nclPath = join(tempDir, "valid.ncl");
			writeFileSync(nclPath, nclContent);

			const result = execSync(
				`npx tsx src/cli/index.ts "${nclPath}" --validate`,
				{
					encoding: "utf-8",
					cwd: process.cwd(),
				},
			);

			expect(result).toContain("Validating nginx configuration");
			expect(result).toContain("✅ Configuration is valid");
		},
	);

	it.skipIf(!dockerAvailable)(
		"should validate NCL file with --validate-only option",
		() => {
			const nclContent = `
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

			const nclPath = join(tempDir, "valid-only.ncl");
			writeFileSync(nclPath, nclContent);

			const result = execSync(
				`npx tsx src/cli/index.ts "${nclPath}" --validate-only`,
				{
					encoding: "utf-8",
					cwd: process.cwd(),
				},
			);

			expect(result).toContain("Validating nginx configuration");
			expect(result).toContain("✅ Configuration is valid");
			expect(result).not.toContain("Generated:");
		},
	);

	it.skipIf(!dockerAvailable)("should detect invalid configuration", () => {
		const nclContent = `
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

		const nclPath = join(tempDir, "invalid.ncl");
		writeFileSync(nclPath, nclContent);

		try {
			execSync(`npx tsx src/cli/index.ts "${nclPath}" --validate-only`, {
				encoding: "utf-8",
				cwd: process.cwd(),
			});
			// Should not reach here
			expect(false).toBe(true);
		} catch (error: any) {
			const output = error.stdout + error.stderr;
			expect(output).toContain("Validating nginx configuration");
			expect(output).toContain("❌ Configuration is invalid");
			expect(error.status).toBe(1);
		}
	});

	it.skipIf(!dockerAvailable)(
		"should work with location regex patterns",
		() => {
			const nclContent = `
      worker_processes auto;
      
      events {
        worker_connections 1024;
      }
      
      http {
        server {
          listen 80;
          server_name example.com;
          
          location "~ \\.php$" {
            return 200 "PHP file";
          }
          
          location "~ \\.(css|js|png|jpg)$" {
            return 200 "Static file";
          }
        }
      }
    `;

			const nclPath = join(tempDir, "regex.ncl");
			writeFileSync(nclPath, nclContent);

			const result = execSync(
				`npx tsx src/cli/index.ts "${nclPath}" --validate`,
				{
					encoding: "utf-8",
					cwd: process.cwd(),
				},
			);

			expect(result).toContain("Validating nginx configuration");
			expect(result).toContain("✅ Configuration is valid");
		},
	);

	it("should show help when validation options are used incorrectly", () => {
		try {
			execSync("npx tsx src/cli/index.ts --validate-only", {
				encoding: "utf-8",
				cwd: process.cwd(),
			});
			// Should not reach here
			expect(false).toBe(true);
		} catch (error: any) {
			// Should exit with error because no input file provided
			expect(error.status).toBe(1);
		}
	});
});
