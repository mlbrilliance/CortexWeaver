/**
 * CLI Entry Point - Stub File
 * 
 * This file serves as a stub that delegates to the modular CLI implementation
 * in the cli/ directory. The actual implementation has been refactored into
 * multiple modules to maintain the 500-line limit per file.
 * 
 * Modular structure:
 * - cli/index.ts - Main CLI orchestrator
 * - cli/commands.ts - Command implementations
 * - cli/parsers.ts - Argument parsing and validation
 * - cli/validators.ts - Input validation and project checks
 * - cli/prompt-improvement-cli.ts - Prompt improvement specific commands
 */

// Re-export the main CLI class and all related types/interfaces
export { 
  CLI,
  CLICommands,
  CLIValidators,
  CLIParsers
} from './cli/index';

export type { 
  ParsedArgs, 
  AgentPersonaInfo, 
  ProjectConfigOptions, 
  AuthMethodConfig, 
  TaskFilters, 
  ValidationResult 
} from './cli/parsers';

// Maintain backward compatibility by providing a default export
import { CLI } from './cli/index';
export default CLI;