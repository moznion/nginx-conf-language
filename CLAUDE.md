# nginx-configuration-language Project Knowledge

## Project Overview
A DSL (Domain-Specific Language) for generating nginx.conf files, written in TypeScript.

### Key Features
1. **Syntax equivalence**: NCL syntax is equivalent to nginx.conf
2. **File extension**: `.ncl`
3. **Enhanced features beyond nginx.conf**:
   - Multiple location directives using list literals
   - Code block definitions and reuse
   - Inline expansion using %inline directive
   - Environment variable support with %env() syntax

## Architecture
- **Parser**: Parses NCL files into AST
- **Transformer**: Handles special syntax (location in, $variables, @inline)
- **Generator**: Generates nginx.conf from AST
- **CLI**: ncl-gen command-line tool

## Development Approach
- TDD (Test Driven Development) using Vitest
- Red-Green-Refactor cycle

## Project Structure
```
src/
├── cli/        # CLI tool implementation
├── generator/  # Code generation logic
└── parser/     # Nginx config parsing logic
tests/          # Test files
```

## Dependencies
- TypeScript 5.8.3
- Vitest 3.2.4
- Commander 14.0.0 (for CLI)
- tsx 4.20.3 (for running TS files)

## Commands
- `npm test` - Run tests
- `npm run build` - Compile TypeScript
- `npm start` - Run compiled JS

## Progress Log

### 2025-06-26
1. ✅ Set up TypeScript project with Vitest
   - Configured tsconfig.json for ES2022 target
   - Set up vitest.config.ts
   - Created .gitignore

2. ✅ Designed AST structure
   - Created comprehensive AST node types
   - Supports all required features:
     - Basic nginx directives and blocks
     - Location with multiple paths (location in)
     - Variable assignments ($var = {})
     - Inline directives (@inline $var)
   - All tests passing

3. ✅ Implemented and tested tokenizer/lexer
   - Comprehensive token types for all NCL syntax
   - Handles strings, comments, numbers, identifiers
   - Special tokens: location modifiers, variables, @inline
   - Proper error handling for unterminated strings
   - All 12 tests passing

4. ✅ Implemented and tested parser
   - Complete recursive descent parser
   - Supports all NCL features:
     - Basic nginx directives and blocks
     - Location blocks with multiple paths (location in)
     - Variable assignments with code blocks
     - @inline directive expansion
   - Robust error handling with proper line/column reporting
   - Special handling for 'if' blocks and nginx built-in variables
   - All 14 tests passing

5. ✅ Implemented code generator
   - Transforms AST back to nginx.conf format
   - Expands 'location in' to multiple blocks
   - Handles @inline expansion with variable substitution
   - Preserves nginx built-in variables like $host, $remote_addr
   - Proper indentation and formatting
   - All 14 tests passing

6. ✅ Created ncl-gen CLI tool
   - Command-line interface using Commander.js
   - Supports file input/output and stdout
   - Options for inline expansion control
   - Custom indentation support
   - Successfully tested with example NCL files

7. ✅ Added comprehensive integration tests
   - Tests complete NCL to nginx.conf transformation
   - Validates all special features work together
   - Tests error handling and edge cases
   - All 9 integration tests passing

## Final Statistics
- Total tests: 84 (79 passing + 5 legacy nginx skipped)
  - Unit tests: 58 (tokenizer, parser, generator, AST)
  - Environment variable tests: 11
  - Integration tests: 14 (includes 6 new environment variable scenarios)
  - Docker nginx validation tests: 6
- Lines of code: ~2,500
- Development time: TDD approach with Red-Green-Refactor cycle
- Test coverage: Comprehensive unit, integration, and nginx validation tests

## Nginx Validation Tests
Added comprehensive nginx validation using two approaches:

### Docker-based Validation (Recommended)
- Uses `nginx:alpine` Docker image for consistent testing
- Tests automatically skip if Docker is not available
- Validates simple configs, location expansion, variable expansion
- Tests all location modifiers and complex configurations
- Environment-independent (works anywhere Docker runs)
- All 6 tests passing

### Legacy Local Nginx Validation
- Uses locally installed nginx for validation
- Tests automatically skip if nginx is not installed
- Same validation scope as Docker tests
- May have environment-specific issues

Both test suites ensure generated configs are syntactically correct for real nginx.

## Special Syntax Transformations
1. **location in [list]**: Expands to multiple location blocks
2. **%variable = { block }**: Defines reusable code blocks
3. **%inline(%variable);**: Expands code block inline (function-like syntax)
4. **%env("VAR_NAME")**: Resolves environment variable at generation time
5. **%env("VAR_NAME", "default")**: Resolves environment variable with default value

## Recent Changes
### 2025-06-27 - Added Import Functionality (%import)
- **New %import syntax**: `%import("/path/to/file.ncl");` for modular configurations
- **Features implemented**:
  - Tokenizer support for %import token type
  - Parser support for import directives with proper error handling
  - Generator support for processing imports with inline content expansion
  - **Circular dependency detection**: Prevents infinite import loops with clear error messages
  - **File resolution**: Supports both relative and absolute import paths
  - **Variable sharing**: Imported files can define variables accessible to importing files
  - **Caching**: Parsed import files are cached to avoid reprocessing
- **Testing**: Comprehensive test suite with 13 tests covering all import scenarios
- **CLI integration**: Updated CLI to pass file paths for proper import resolution
- **Documentation**: Updated README.md with import examples and created demo files
- **Example files**: Created `imports-demo.ncl` and shared configuration modules
- **Import syntax**: Requires parentheses and semicolon: `%import("path");`
- All 92 + 13 = 105 tests passing (import tests + existing tests)

### 2025-06-27 - Updated %inline to Function-like Syntax
- Changed `%inline %variable` syntax to function-like `%inline(%variable);` format
- Updated tokenizer to recognize `%inline` followed by `(` as inline token
- Updated parser to expect parentheses and semicolon: `%inline(%var);`
- Updated generator to output new syntax when expandInline is false
- Updated all tests (tokenizer, parser, generator, integration, nginx-docker-validation, environment-variables)
- Updated all documentation (README.md) and example files (sample.ncl, comprehensive.ncl, environment-demo.ncl)
- Provides clearer distinction between NCL directives and variable references
- All 92 tests passing

### 2025-06-26 - Environment Variable Support
- Added `%env("VAR_NAME")` syntax for environment variable resolution
- Support for default values with `%env("VAR_NAME", "default")`
- Environment variables work in directive arguments, block arguments, and location paths
- Integration with existing %inline variable expansion
- Comprehensive test suite with 11 environment variable tests
- Updated integration tests with 6 additional environment variable scenarios
- Updated README.md and examples to showcase environment variable features
- All 84 tests passing (79 + 5 legacy nginx skipped)

### 2025-06-26 - Syntax Unification  
- Changed variable literal prefix from `$` to `%`
- Changed inline directive from `@inline` to `%inline`
- All NCL special syntax now uses `%` prefix for consistency
- Updated all code examples, tests, and documentation
- Maintains compatibility with nginx built-in variables (still use `$`)
- All 68 tests passing with unified syntax