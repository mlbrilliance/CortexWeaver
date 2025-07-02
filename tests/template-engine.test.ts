import { TemplateEngine, TemplateContext } from '../src/template-engine';
import * as fs from 'fs/promises';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('TemplateEngine', () => {
  let templateEngine: TemplateEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    templateEngine = new TemplateEngine('./test-prompts');
  });

  describe('variable substitution', () => {
    it('should replace simple variables', async () => {
      const template = 'Hello {{name}}, welcome to {{system}}!';
      const context = { name: 'Alice', system: 'CortexWeaver' };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toBe('Hello Alice, welcome to CortexWeaver!');
    });

    it('should handle nested object properties', async () => {
      const template = 'Task: {{task.title}} - Priority: {{task.priority}}';
      const context = {
        task: {
          title: 'Implement authentication',
          priority: 'high'
        }
      };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toBe('Task: Implement authentication - Priority: high');
    });

    it('should handle missing variables gracefully', async () => {
      const template = 'Hello {{name}}, your score is {{score}}';
      const context = { name: 'Bob' };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toBe('Hello Bob, your score is ');
    });
  });

  describe('conditional blocks', () => {
    it('should render conditional blocks when condition is true', async () => {
      const template = `
        {{#if hasContracts}}
        Available contracts:
        - Contract data here
        {{/if}}
      `;
      const context = { hasContracts: true };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toContain('Available contracts:');
      expect(result).toContain('Contract data here');
    });

    it('should skip conditional blocks when condition is false', async () => {
      const template = `
        {{#if hasContracts}}
        Available contracts:
        - Contract data here
        {{/if}}
        Always shown content
      `;
      const context = { hasContracts: false };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).not.toContain('Available contracts:');
      expect(result).toContain('Always shown content');
    });

    it('should handle array conditions correctly', async () => {
      const template = `
        {{#if contracts}}
        We have contracts
        {{/if}}
      `;

      mockFs.readFile.mockResolvedValue(template);

      // Empty array should be falsy
      let result = await templateEngine.render('test.md', { contracts: [] });
      expect(result).not.toContain('We have contracts');

      // Non-empty array should be truthy
      result = await templateEngine.render('test.md', { contracts: [{ name: 'test' }] });
      expect(result).toContain('We have contracts');
    });

    it('should handle nested properties in conditions', async () => {
      const template = `
        {{#if task.dependencies}}
        Task has dependencies
        {{/if}}
      `;
      const context = {
        task: {
          dependencies: ['dep1', 'dep2']
        }
      };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toContain('Task has dependencies');
    });
  });

  describe('loop blocks', () => {
    it('should iterate over arrays', async () => {
      const template = `
        {{#each contracts}}
        - {{name}} ({{type}})
        {{/each}}
      `;
      const context = {
        contracts: [
          { name: 'User API', type: 'openapi' },
          { name: 'Data Schema', type: 'json-schema' }
        ]
      };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toContain('- User API (openapi)');
      expect(result).toContain('- Data Schema (json-schema)');
    });

    it('should handle empty arrays', async () => {
      const template = `
        {{#each items}}
        - {{name}}
        {{/each}}
        End of list
      `;
      const context = { items: [] };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toContain('End of list');
      expect(result).not.toContain('- ');
    });

    it('should handle non-array values gracefully', async () => {
      const template = `
        {{#each notAnArray}}
        - {{item}}
        {{/each}}
      `;
      const context = { notAnArray: 'string value' };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      // Should not render anything for non-arrays
      expect(result.trim()).toBe('');
    });
  });

  describe('complex templates', () => {
    it('should handle nested conditionals and loops', async () => {
      const template = `
        {{#if pheromones}}
        Recent insights:
        {{#each pheromones}}
        {{#if type}}
        - {{type}}: {{context}} (strength: {{strength}})
        {{/if}}
        {{/each}}
        {{/if}}
      `;
      const context = {
        pheromones: [
          { type: 'success', context: 'Authentication works', strength: 0.9 },
          { type: 'warning', context: 'Performance issue', strength: 0.6 }
        ]
      };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toContain('Recent insights:');
      expect(result).toContain('- success: Authentication works (strength: 0.9)');
      expect(result).toContain('- warning: Performance issue (strength: 0.6)');
    });

    it('should handle mixed content types', async () => {
      const template = `
        Agent: {{agentType}}
        Task: {{task.title}}
        
        {{#if architecturalDecisions}}
        Architectural Decisions:
        {{#each architecturalDecisions}}
        - {{title}}: {{description}}
        {{/each}}
        {{/if}}
        
        {{#if codeModules}}
        Related Code:
        {{#each codeModules}}
        - {{name}} ({{language}})
        {{/each}}
        {{/if}}
      `;
      const context = {
        agentType: 'Coder',
        task: {
          title: 'Implement user service'
        },
        architecturalDecisions: [
          { title: 'Database Choice', description: 'Use PostgreSQL for relational data' }
        ],
        codeModules: [
          { name: 'UserService', language: 'typescript' },
          { name: 'UserRepository', language: 'typescript' }
        ]
      };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toContain('Agent: Coder');
      expect(result).toContain('Task: Implement user service');
      expect(result).toContain('Architectural Decisions:');
      expect(result).toContain('- Database Choice: Use PostgreSQL for relational data');
      expect(result).toContain('Related Code:');
      expect(result).toContain('- UserService (typescript)');
    });
  });

  describe('file operations', () => {
    it('should cache template files', async () => {
      const template = 'Hello {{name}}';
      mockFs.readFile.mockResolvedValue(template);

      await templateEngine.render('test.md', { name: 'Alice' });
      await templateEngine.render('test.md', { name: 'Bob' });

      // Should only read file once due to caching
      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(templateEngine.render('missing.md', {}))
        .rejects.toThrow('Failed to load template');
    });

    it('should support absolute paths', async () => {
      const template = 'Absolute path template';
      mockFs.readFile.mockResolvedValue(template);

      await templateEngine.render('/absolute/path/template.md', {});

      expect(mockFs.readFile).toHaveBeenCalledWith('/absolute/path/template.md', 'utf-8');
    });

    it('should clear cache when requested', async () => {
      const template = 'Cached template';
      mockFs.readFile.mockResolvedValue(template);

      await templateEngine.render('test.md', {});
      templateEngine.clearCache();
      await templateEngine.render('test.md', {});

      // Should read file twice after cache clear
      expect(mockFs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('value formatting', () => {
    it('should format objects as JSON', async () => {
      const template = 'Config: {{config}}';
      const context = {
        config: {
          debug: true,
          port: 3000
        }
      };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toContain('"debug": true');
      expect(result).toContain('"port": 3000');
    });

    it('should format arrays as comma-separated values', async () => {
      const template = 'Tags: {{tags}}';
      const context = {
        tags: ['typescript', 'node', 'auth']
      };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toBe('Tags: typescript, node, auth');
    });

    it('should handle null and undefined values', async () => {
      const template = 'Null: {{nullValue}}, Undefined: {{undefinedValue}}';
      const context = {
        nullValue: null,
        undefinedValue: undefined
      };

      mockFs.readFile.mockResolvedValue(template);

      const result = await templateEngine.render('test.md', context);

      expect(result).toBe('Null: , Undefined: ');
    });
  });
});