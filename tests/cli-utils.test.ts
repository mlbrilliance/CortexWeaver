import { CLIUtils } from '../src/cli-utils';
import { CLITemplates } from '../src/cli-templates';
import * as fs from 'fs';
import * as path from 'path';

describe('CLIUtils', () => {
  const testProjectRoot = '/tmp/test-cortexweaver-utils';
  
  beforeEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true });
    }
    fs.mkdirSync(testProjectRoot, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testProjectRoot)) {
      fs.rmSync(testProjectRoot, { recursive: true });
    }
  });

  describe('validatePrototypesStructure', () => {
    it('should return invalid when prototypes directory does not exist', () => {
      const result = CLIUtils.validatePrototypesStructure(testProjectRoot);
      
      expect(result.isValid).toBe(false);
      expect(result.missingDirs).toContain('prototypes');
    });

    it('should validate complete prototypes structure', async () => {
      // Create complete prototypes structure
      await CLITemplates.createPrototypesDirectory(testProjectRoot);
      
      const result = CLIUtils.validatePrototypesStructure(testProjectRoot);
      
      expect(result.isValid).toBe(true);
      expect(result.missingDirs).toHaveLength(0);
    });

    it('should identify missing subdirectories', async () => {
      // Create prototypes directory but not subdirectories
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      fs.mkdirSync(prototypesPath, { recursive: true });
      
      const result = CLIUtils.validatePrototypesStructure(testProjectRoot);
      
      expect(result.isValid).toBe(false);
      expect(result.missingDirs).toContain('features');
      expect(result.missingDirs).toContain('experiments');
      expect(result.missingDirs).toContain('algorithms');
      expect(result.missingDirs).toContain('README.md');
    });

    it('should identify missing README.md', async () => {
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      
      // Create directories but not README
      const subdirs = [
        'features', 'experiments', 'proofs-of-concept', 
        'spike-solutions', 'technical-demos', 'ui-mockups',
        'data-models', 'algorithms'
      ];
      
      subdirs.forEach(subdir => {
        fs.mkdirSync(path.join(prototypesPath, subdir), { recursive: true });
      });
      
      const result = CLIUtils.validatePrototypesStructure(testProjectRoot);
      
      expect(result.isValid).toBe(false);
      expect(result.missingDirs).toContain('README.md');
      expect(result.missingDirs).not.toContain('features');
    });

    it('should handle partial structure correctly', () => {
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      
      // Create only some subdirectories
      fs.mkdirSync(path.join(prototypesPath, 'features'), { recursive: true });
      fs.mkdirSync(path.join(prototypesPath, 'algorithms'), { recursive: true });
      
      const result = CLIUtils.validatePrototypesStructure(testProjectRoot);
      
      expect(result.isValid).toBe(false);
      expect(result.missingDirs).toContain('experiments');
      expect(result.missingDirs).toContain('proofs-of-concept');
      expect(result.missingDirs).not.toContain('features');
      expect(result.missingDirs).not.toContain('algorithms');
    });
  });

  describe('validateProject', () => {
    it('should return false for missing prototypes directory', () => {
      // Create all other required structure except prototypes
      const cortexDir = path.join(testProjectRoot, '.cortexweaver');
      fs.mkdirSync(cortexDir, { recursive: true });
      fs.writeFileSync(path.join(cortexDir, 'config.json'), '{}');
      fs.writeFileSync(path.join(testProjectRoot, 'plan.md'), '# Plan');
      
      // Create contracts structure
      const contractsDirs = [
        'contracts', 'contracts/api', 'contracts/schemas', 
        'contracts/properties', 'contracts/examples'
      ];
      contractsDirs.forEach(dir => {
        fs.mkdirSync(path.join(testProjectRoot, dir), { recursive: true });
      });
      
      // Missing prototypes directory
      const isValid = CLIUtils.validateProject(testProjectRoot);
      expect(isValid).toBe(false);
    });

    it('should return true for complete project structure including prototypes', async () => {
      // Create all required structure
      const cortexDir = path.join(testProjectRoot, '.cortexweaver');
      fs.mkdirSync(cortexDir, { recursive: true });
      fs.writeFileSync(path.join(cortexDir, 'config.json'), '{}');
      fs.writeFileSync(path.join(testProjectRoot, 'plan.md'), '# Plan');
      
      // Create contracts structure
      const contractsDirs = [
        'contracts', 'contracts/api', 'contracts/schemas', 
        'contracts/properties', 'contracts/examples'
      ];
      contractsDirs.forEach(dir => {
        fs.mkdirSync(path.join(testProjectRoot, dir), { recursive: true });
      });
      
      // Create prototypes directory
      await CLITemplates.createPrototypesDirectory(testProjectRoot);
      
      const isValid = CLIUtils.validateProject(testProjectRoot);
      expect(isValid).toBe(true);
    });
  });

  describe('parseAgentPersona', () => {
    it('should parse agent persona correctly', () => {
      const content = `# Test Agent

## Role
Test Role

## Description
A test agent description.

## Capabilities
- Test capability 1
- Test capability 2
`;

      const parsed = CLIUtils.parseAgentPersona(content, 'test-agent.md');
      
      expect(parsed.name).toBe('Test Agent');
      expect(parsed.role).toBe('Test Role');
      expect(parsed.description).toBe('A test agent description.');
    });

    it('should handle missing sections gracefully', () => {
      const content = `# Test Agent

Some content without standard sections.
`;

      const parsed = CLIUtils.parseAgentPersona(content, 'test-agent.md');
      
      expect(parsed.name).toBe('Test Agent');
      expect(parsed.role).toBe('Unknown Role');
      expect(parsed.description).toBe('No description available');
    });
  });

  describe('getTaskStatusIcon', () => {
    it('should return correct icons for task statuses', () => {
      expect(CLIUtils.getTaskStatusIcon('pending')).toBe('⏳');
      expect(CLIUtils.getTaskStatusIcon('running')).toBe('🔄');
      expect(CLIUtils.getTaskStatusIcon('completed')).toBe('✅');
      expect(CLIUtils.getTaskStatusIcon('failed')).toBe('❌');
      expect(CLIUtils.getTaskStatusIcon('impasse')).toBe('🚧');
      expect(CLIUtils.getTaskStatusIcon('unknown')).toBe('❓');
    });
  });
});