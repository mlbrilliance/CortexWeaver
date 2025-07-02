#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CLI } from './cli';
import { ConfigService } from './config';

const cli = new CLI();

yargs(hideBin(process.argv))
  .scriptName('cortex-weaver')
  .usage('$0 <cmd> [args]')
  .command(
    'init [path]',
    'Initialize a new CortexWeaver project',
    (yargs) => {
      yargs.positional('path', {
        type: 'string',
        default: process.cwd(),
        describe: 'Project directory path'
      });
    },
    async (argv) => {
      try {
        await cli.init(argv.path as string);
      } catch (error) {
        console.error('❌ Failed to initialize project:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'status [path]',
    'Show project status and active tasks',
    (yargs) => {
      yargs.positional('path', {
        type: 'string',
        default: process.cwd(),
        describe: 'Project directory path'
      });
    },
    async (argv) => {
      try {
        const status = await cli.status(argv.path as string);
        console.log(status);
      } catch (error) {
        console.error('❌ Failed to get status:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'start [path]',
    'Start the orchestrator agent',
    (yargs) => {
      yargs.positional('path', {
        type: 'string',
        default: process.cwd(),
        describe: 'Project directory path'
      });
    },
    async (argv) => {
      try {
        await cli.start(argv.path as string);
      } catch (error) {
        console.error('❌ Failed to start orchestrator:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'logs <task-id> [path]',
    'Print full log output of completed/running tasks',
    (yargs) => {
      yargs.positional('task-id', {
        type: 'string',
        describe: 'Task ID to retrieve logs for',
        demandOption: true
      }).positional('path', {
        type: 'string',
        default: process.cwd(),
        describe: 'Project directory path'
      });
    },
    async (argv) => {
      try {
        const logs = await cli.logs(argv['task-id'] as string, argv.path as string);
        console.log(logs);
      } catch (error) {
        console.error('❌ Failed to retrieve logs:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'retry <task-id> [path]',
    'Re-queue failed tasks for retry',
    (yargs) => {
      yargs.positional('task-id', {
        type: 'string',
        describe: 'Task ID to retry',
        demandOption: true
      }).positional('path', {
        type: 'string',
        default: process.cwd(),
        describe: 'Project directory path'
      });
    },
    async (argv) => {
      try {
        await cli.retry(argv['task-id'] as string, argv.path as string);
      } catch (error) {
        console.error('❌ Failed to retry task:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'list-agents [path]',
    'Display all available agent personas from /prompts directory',
    (yargs) => {
      yargs.positional('path', {
        type: 'string',
        default: process.cwd(),
        describe: 'Project directory path'
      });
    },
    async (argv) => {
      try {
        const agentList = await cli.listAgents(argv.path as string);
        console.log(agentList);
      } catch (error) {
        console.error('❌ Failed to list agents:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'attach <task-id>',
    'Attach to a running agent task session',
    (yargs) => {
      yargs.positional('task-id', {
        type: 'string',
        describe: 'Task ID to attach to',
        demandOption: true
      });
    },
    async (argv) => {
      try {
        const attachCommand = await cli.attach(argv['task-id'] as string);
        console.log(`🔗 Attaching to task: ${argv['task-id']}`);
        console.log(`Run: ${attachCommand}`);
      } catch (error) {
        console.error('❌ Failed to attach to session:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'merge <task-id> [path]',
    'Merge completed task back to main branch',
    (yargs) => {
      yargs.positional('task-id', {
        type: 'string',
        describe: 'Task ID to merge',
        demandOption: true
      }).positional('path', {
        type: 'string',
        default: process.cwd(),
        describe: 'Project directory path'
      });
    },
    async (argv) => {
      try {
        await cli.merge(argv.path as string, argv['task-id'] as string);
      } catch (error) {
        console.error('❌ Failed to merge task:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .command(
    'auth <command> [method]',
    'Manage authentication for CortexWeaver',
    (yargs) => {
      yargs
        .positional('command', {
          type: 'string',
          describe: 'Authentication command',
          choices: ['status', 'configure', 'switch'],
          demandOption: true
        })
        .positional('method', {
          type: 'string',
          describe: 'Authentication method',
          choices: ['claude-code', 'gemini-cli', 'direct-api']
        })
        .example('$0 auth status', 'Show current authentication status')
        .example('$0 auth configure claude-code', 'Configure Claude Code authentication')
        .example('$0 auth switch gemini-cli', 'Switch to Gemini CLI authentication');
    },
    async (argv) => {
      try {
        const command = argv.command as string;
        const method = argv.method as string | undefined;

        switch (command) {
          case 'status':
            const status = await cli.authStatus();
            console.log(status);
            break;
          
          case 'configure':
            await cli.authConfigure(method);
            break;
          
          case 'switch':
            if (!method) {
              console.error('❌ Method is required for switch command');
              console.log('Available methods: claude-code, gemini-cli, direct-api');
              process.exit(1);
            }
            await cli.authSwitch(method);
            break;
          
          default:
            console.error(`❌ Unknown auth command: ${command}`);
            process.exit(1);
        }
      } catch (error) {
        console.error('❌ Authentication command failed:', (error as Error).message);
        process.exit(1);
      }
    }
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .alias('h', 'help')
  .version('1.0.0')
  .alias('v', 'version')
  .parse();