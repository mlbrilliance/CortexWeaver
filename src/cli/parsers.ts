/**
 * CLI Parsers and Utilities
 * Contains argument parsing logic and utility functions
 */
export class CLIParsers {
  
  /**
   * Parse command line arguments for the CLI
   */
  static parseArguments(args: string[]): ParsedArgs {
    const parsed: ParsedArgs = {
      command: '',
      options: {},
      flags: [],
      positional: []
    };

    if (args.length === 0) {
      return parsed;
    }

    // First argument is the command
    parsed.command = args[0];
    
    // Parse remaining arguments
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        // Long option
        const [key, value] = arg.substring(2).split('=', 2);
        if (value !== undefined) {
          parsed.options[key] = value;
        } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          parsed.options[key] = args[++i];
        } else {
          parsed.flags.push(key);
        }
      } else if (arg.startsWith('-')) {
        // Short option
        const key = arg.substring(1);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          parsed.options[key] = args[++i];
        } else {
          parsed.flags.push(key);
        }
      } else {
        // Positional argument
        parsed.positional.push(arg);
      }
    }

    return parsed;
  }

  /**
   * Parse agent persona content to extract metadata
   */
  static parseAgentPersona(content: string, filename: string): AgentPersonaInfo {
    const lines = content.split('\n');
    let name = filename.replace(/\.(md|txt)$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let role = 'Unknown Role';
    let description = 'No description available';

    // Parse markdown format
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('# ') && name === filename.replace(/\.(md|txt)$/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())) {
        name = line.substring(2).trim();
      } else if (line.startsWith('## Role')) {
        role = lines[i + 1]?.trim() || role;
      } else if (line.startsWith('## Description')) {
        description = lines[i + 1]?.trim() || description;
      }
    }

    return { name, role, description };
  }

  /**
   * Parse project configuration from command line options
   */
  static parseProjectConfig(options: Record<string, string>): ProjectConfigOptions {
    const config: ProjectConfigOptions = {};

    if (options.project || options.p) {
      config.projectRoot = options.project || options.p;
    }

    if (options.config || options.c) {
      config.configFile = options.config || options.c;
    }

    if (options.model || options.m) {
      config.model = options.model || options.m;
    }

    if (options.budget || options.b) {
      const budget = parseFloat(options.budget || options.b);
      if (!isNaN(budget)) {
        config.budget = budget;
      }
    }

    if (options.verbose || options.v) {
      config.verbose = true;
    }

    if (options.quiet || options.q) {
      config.quiet = true;
    }

    if (options.dryrun || options.dr) {
      config.dryRun = true;
    }

    return config;
  }

  /**
   * Parse authentication method from command line
   */
  static parseAuthMethod(methodString: string): AuthMethodConfig {
    const parts = methodString.split(':');
    const method = parts[0];
    const options: Record<string, string> = {};

    if (parts.length > 1) {
      const optionPairs = parts[1].split(',');
      for (const pair of optionPairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          options[key.trim()] = value.trim();
        }
      }
    }

    return {
      method: method as AuthMethod,
      options
    };
  }

  /**
   * Parse task filters for status and logs commands
   */
  static parseTaskFilters(options: Record<string, string>): TaskFilters {
    const filters: TaskFilters = {};

    if (options.status || options.s) {
      filters.status = options.status || options.s;
    }

    if (options.agent || options.a) {
      filters.agent = options.agent || options.a;
    }

    if (options.project || options.p) {
      filters.project = options.project || options.p;
    }

    if (options.since) {
      filters.since = new Date(options.since);
    }

    if (options.until) {
      filters.until = new Date(options.until);
    }

    if (options.limit || options.l) {
      const limit = parseInt(options.limit || options.l);
      if (!isNaN(limit)) {
        filters.limit = limit;
      }
    }

    return filters;
  }

  /**
   * Validate command arguments
   */
  static validateCommand(command: string, args: ParsedArgs): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (command) {
      case 'init':
        // Init command validation
        if (args.positional.length > 1) {
          warnings.push('Extra positional arguments will be ignored');
        }
        break;

      case 'start':
        // Start command validation
        if (args.options.budget) {
          const budget = parseFloat(args.options.budget);
          if (isNaN(budget) || budget <= 0) {
            errors.push('Budget must be a positive number');
          }
        }
        break;

      case 'auth':
        // Auth command validation
        const subcommand = args.positional[0];
        if (!['status', 'configure', 'switch'].includes(subcommand)) {
          errors.push('Auth subcommand must be one of: status, configure, switch');
        }
        if (subcommand === 'switch' && !args.positional[1]) {
          errors.push('Auth switch requires a method argument');
        }
        break;

      case 'logs':
        // Logs command validation
        if (!args.positional[0]) {
          errors.push('Logs command requires a task ID');
        }
        break;

      case 'retry':
        // Retry command validation
        if (!args.positional[0]) {
          errors.push('Retry command requires a task ID');
        }
        break;

      case 'merge':
        // Merge command validation
        if (!args.positional[0]) {
          errors.push('Merge command requires a task ID');
        }
        break;

      case 'attach':
        // Attach command validation
        if (!args.positional[0]) {
          errors.push('Attach command requires a session ID');
        }
        break;

      default:
        if (command) {
          errors.push(`Unknown command: ${command}`);
        } else {
          errors.push('No command specified');
        }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Format help text for commands
   */
  static formatHelp(command?: string): string {
    if (!command) {
      return this.getGeneralHelp();
    }

    switch (command) {
      case 'init':
        return this.getInitHelp();
      case 'start':
        return this.getStartHelp();
      case 'auth':
        return this.getAuthHelp();
      case 'status':
        return this.getStatusHelp();
      case 'logs':
        return this.getLogsHelp();
      case 'retry':
        return this.getRetryHelp();
      case 'merge':
        return this.getMergeHelp();
      case 'attach':
        return this.getAttachHelp();
      case 'cleanup':
        return this.getCleanupHelp();
      case 'list-agents':
        return this.getListAgentsHelp();
      default:
        return `Unknown command: ${command}\n\n${this.getGeneralHelp()}`;
    }
  }

  private static getGeneralHelp(): string {
    return `
CortexWeaver CLI - AI-Powered Development Orchestration

Usage: cortex-weaver <command> [options]

Commands:
  init              Initialize a new CortexWeaver project
  start             Start the orchestration loop
  auth              Manage authentication (status|configure|switch)
  status            Show project status
  logs <task-id>    Show logs for a specific task
  retry <task-id>   Retry a failed task
  merge <task-id>   Merge a completed task to main branch
  attach <session>  Attach to a tmux session
  cleanup           Clean up dead sessions and worktrees
  list-agents       List available agent personas

Global Options:
  -p, --project <path>    Project root directory
  -c, --config <file>     Configuration file path
  -v, --verbose           Enable verbose output
  -q, --quiet             Suppress non-essential output
  -h, --help              Show help information

For command-specific help: cortex-weaver <command> --help
    `.trim();
  }

  private static getInitHelp(): string {
    return `Initialize a new CortexWeaver project

Usage: cortex-weaver init [project-path]
Options: --template <name>, --force, -h/--help`;
  }

  private static getStartHelp(): string {
    return `Start the CortexWeaver orchestration loop

Usage: cortex-weaver start [options]
Options: -b/--budget <amount>, -m/--model <name>, --dry-run, --no-monitoring`;
  }

  private static getAuthHelp(): string {
    return `Manage authentication for CortexWeaver

Usage: cortex-weaver auth <subcommand>
Subcommands: status, configure, switch <method>
Methods: claude-code, gemini-cli, direct-api`;
  }

  private static getStatusHelp(): string {
    return `Show CortexWeaver project status

Usage: cortex-weaver status [options]
Options: --format <type>, --filter <criteria>, --watch`;
  }

  private static getLogsHelp(): string {
    return `Show logs for a specific task

Usage: cortex-weaver logs <task-id> [options]
Options: --follow, --lines <n>, --format <type>`;
  }

  private static getRetryHelp(): string {
    return `Retry a failed task

Usage: cortex-weaver retry <task-id> [options]
Options: --force, --reset`;
  }

  private static getMergeHelp(): string {
    return `Merge a completed task to main branch

Usage: cortex-weaver merge <task-id> [options]
Options: --branch <name>, --squash, --no-delete`;
  }

  private static getAttachHelp(): string {
    return `Attach to a tmux session

Usage: cortex-weaver attach <session-id> [options]
Options: --read-only`;
  }

  private static getCleanupHelp(): string {
    return `Clean up dead sessions and worktrees

Usage: cortex-weaver cleanup [options]
Options: --force, --sessions-only, --worktrees-only`;
  }

  private static getListAgentsHelp(): string {
    return `List available agent personas

Usage: cortex-weaver list-agents [options]
Options: --format <type>, --filter <pattern>, --detailed`;
  }
}

// Type definitions for parsed arguments
export interface ParsedArgs {
  command: string;
  options: Record<string, string>;
  flags: string[];
  positional: string[];
}

export interface AgentPersonaInfo {
  name: string;
  role: string;
  description: string;
}

export interface ProjectConfigOptions {
  projectRoot?: string;
  configFile?: string;
  model?: string;
  budget?: number;
  verbose?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
}

export type AuthMethod = 'claude-code' | 'gemini-cli' | 'direct-api';

export interface AuthMethodConfig {
  method: AuthMethod;
  options: Record<string, string>;
}

export interface TaskFilters {
  status?: string;
  agent?: string;
  project?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}