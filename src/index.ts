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
      console.log(`🔗 Attaching to task: ${argv.taskId}`);
      console.log('⚠️  Session attachment implementation coming soon!');
      // TODO: Implement tmux session attachment
    }
  )
  .command(
    'merge <task-id>',
    'Merge completed task back to main branch',
    (yargs) => {
      yargs.positional('task-id', {
        type: 'string',
        describe: 'Task ID to merge',
        demandOption: true
      });
    },
    async (argv) => {
      console.log(`🔀 Merging task: ${argv.taskId}`);
      console.log('⚠️  Task merging implementation coming soon!');
      // TODO: Implement git worktree merging
    }
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .alias('h', 'help')
  .version('1.0.0')
  .alias('v', 'version')
  .parse();