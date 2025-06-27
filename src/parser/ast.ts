/**
 * Abstract Syntax Tree node types for nginx configuration language
 */

/**
 * Position information for AST nodes
 */
export interface Position {
  line: number;
  column: number;
}

/**
 * Base interface for all AST nodes
 */
export interface BaseNode {
  type: string;
  position: Position;
}

/**
 * Root configuration node
 */
export interface ConfigNode extends BaseNode {
  type: 'config';
  children: ASTNode[];
}

/**
 * Simple directive node (e.g., worker_processes auto;)
 */
export interface DirectiveNode extends BaseNode {
  type: 'directive';
  name: string;
  args: string[];
}

/**
 * Block directive node (e.g., http { ... })
 */
export interface BlockNode extends BaseNode {
  type: 'block';
  name: string;
  args: string[];
  children: ASTNode[];
}

/**
 * Location modifier types
 */
export enum LocationModifier {
  None = '',
  Exact = '=',
  Regex = '~',
  RegexCaseInsensitive = '~*',
  Prefix = '^~'
}

/**
 * Location block node with support for multiple paths
 */
export interface LocationNode extends BaseNode {
  type: 'location';
  modifier: LocationModifier;
  paths: string[];
  children: ASTNode[];
}

/**
 * Variable assignment node (e.g., $var = { ... })
 */
export interface VariableAssignmentNode extends BaseNode {
  type: 'variable_assignment';
  name: string;
  value: BlockNode;
}

/**
 * Inline directive node (e.g., %inline %var)
 */
export interface InlineDirectiveNode extends BaseNode {
  type: 'inline';
  variableName: string;
}

/**
 * Environment variable node (e.g., %env("PORT"))
 */
export interface EnvironmentVariableNode extends BaseNode {
  type: 'env_var';
  variableName: string;
  defaultValue?: string;
}

/**
 * Import directive node (e.g., %import("/path/to/file.ncl"))
 */
export interface ImportNode extends BaseNode {
  type: 'import';
  path: string;
}

/**
 * Union type for all AST nodes
 */
export type ASTNode = 
  | ConfigNode
  | DirectiveNode
  | BlockNode
  | LocationNode
  | VariableAssignmentNode
  | InlineDirectiveNode
  | EnvironmentVariableNode
  | ImportNode;