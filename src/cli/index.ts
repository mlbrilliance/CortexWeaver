import { CLICommands } from './commands';
import { CLIValidators } from './validators';
import { CLIParsers, ParsedArgs } from './parsers';

/**
 * Main CLI class - refactored to use modular components
 * This serves as the main entry point and orchestrates the various CLI modules
 */
export class CLI {
  private commands: CLICommands;
  private validators: CLIValidators;

  constructor() {
    this.commands = new CLICommands();
    this.validators = new CLIValidators();
  }

  // Authentication commands
  async authStatus(projectRoot: string = process.cwd()): Promise<string> {
    return this.commands.authStatus(projectRoot);
  }

  async authConfigure(method?: string, projectRoot: string = process.cwd()): Promise<string> {
    return this.commands.authConfigure(method, projectRoot);
  }

  async authSwitch(method: string, projectRoot: string = process.cwd()): Promise<void> {
    return this.commands.authSwitch(method, projectRoot);
  }

  // Task management commands
  async logs(taskId: string, projectRoot: string = process.cwd()): Promise<string> {
    return this.commands.logs(taskId, projectRoot);
  }

  async retry(taskId: string, projectRoot: string = process.cwd()): Promise<void> {
    return this.commands.retry(taskId, projectRoot);
  }

  // Agent management commands
  async listAgents(projectRoot: string = process.cwd()): Promise<string> {
    return this.commands.listAgents(projectRoot);
  }

  // Project lifecycle commands
  async init(projectRoot: string = process.cwd()): Promise<void> {
    return this.commands.init(projectRoot);
  }

  // Status and monitoring commands
  async status(projectRoot: string = process.cwd()): Promise<string> {
    return this.validators.status(projectRoot);
  }

  // Orchestration commands
  async start(projectRoot: string = process.cwd()): Promise<void> {
    return this.validators.start(projectRoot);
  }

  // Session management commands
  async attach(sessionId: string): Promise<string> {
    return this.validators.attach(sessionId);
  }

  async merge(projectRoot: string = process.cwd(), taskId: string): Promise<void> {
    return this.validators.merge(projectRoot, taskId);
  }

  // Maintenance commands
  async cleanup(projectRoot: string = process.cwd()): Promise<string> {
    return this.validators.cleanup(projectRoot);
  }

  // Validation method (moved to CLIUtils but kept for compatibility)
  validateProject(projectRoot: string): boolean {
    // Import CLIUtils here to avoid circular dependencies
    const { CLIUtils } = require('../cli-utils');
    return CLIUtils.validateProject(projectRoot);
  }

  // Static method to parse command line arguments
  static parseArguments(args: string[]): ParsedArgs {
    return CLIParsers.parseArguments(args);
  }

  // Static method to validate parsed commands
  static validateCommand(command: string, args: ParsedArgs) {
    return CLIParsers.validateCommand(command, args);
  }

  // Static method to get help text
  static getHelp(command?: string): string {
    return CLIParsers.formatHelp(command);
  }

  // Execute a command with parsed arguments
  async executeCommand(command: string, args: ParsedArgs, projectRoot?: string): Promise<any> {
    const root = projectRoot || args.options.project || args.options.p || process.cwd();

    switch (command) {
      case 'init':
        return this.init(args.positional[0] || root);

      case 'start':
        return this.start(root);

      case 'auth':
        const subcommand = args.positional[0];
        switch (subcommand) {
          case 'status':
            return this.authStatus(root);
          case 'configure':
            return this.authConfigure(args.positional[1], root);
          case 'switch':
            return this.authSwitch(args.positional[1], root);
          default:
            throw new Error(`Unknown auth subcommand: ${subcommand}`);
        }

      case 'status':
        return this.status(root);

      case 'logs':
        return this.logs(args.positional[0], root);

      case 'retry':
        return this.retry(args.positional[0], root);

      case 'merge':
        return this.merge(root, args.positional[0]);

      case 'attach':
        return this.attach(args.positional[0]);

      case 'cleanup':
        return this.cleanup(root);

      case 'list-agents':
        return this.listAgents(root);

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
}

// Re-export modular components for direct access if needed
export { CLICommands } from './commands';
export { CLIValidators } from './validators';
export { CLIParsers } from './parsers';
export type { ParsedArgs, AgentPersonaInfo, ProjectConfigOptions, AuthMethodConfig, TaskFilters, ValidationResult } from './parsers';