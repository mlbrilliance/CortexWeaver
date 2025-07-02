import { CLITemplates } from '../src/cli-templates';
import * as fs from 'fs';
import * as path from 'path';

describe('CLITemplates', () => {
  const testProjectRoot = '/tmp/test-cortexweaver-templates';
  
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

  describe('createPrototypesDirectory', () => {
    it('should create prototypes directory with all required subdirectories', async () => {
      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      expect(fs.existsSync(prototypesPath)).toBe(true);

      const expectedSubdirs = [
        'features',
        'experiments',
        'proofs-of-concept',
        'spike-solutions',
        'technical-demos',
        'ui-mockups',
        'data-models',
        'algorithms'
      ];

      expectedSubdirs.forEach(subdir => {
        const subdirPath = path.join(prototypesPath, subdir);
        expect(fs.existsSync(subdirPath)).toBe(true);
        expect(fs.statSync(subdirPath).isDirectory()).toBe(true);
      });
    });

    it('should create README.md with comprehensive documentation', async () => {
      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      const readmePath = path.join(testProjectRoot, 'prototypes', 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const readmeContent = fs.readFileSync(readmePath, 'utf-8');
      
      // Check for key sections
      expect(readmeContent).toContain('# CortexWeaver Prototypes Directory');
      expect(readmeContent).toContain('## Purpose');
      expect(readmeContent).toContain('## Directory Structure');
      expect(readmeContent).toContain('## Workflow Integration');
      expect(readmeContent).toContain('## Best Practices');
      expect(readmeContent).toContain('## Getting Started');

      // Check for specific content
      expect(readmeContent).toContain('Rapid Experimentation');
      expect(readmeContent).toContain('Technical Feasibility');
      expect(readmeContent).toContain('Prototyper Agent');
      expect(readmeContent).toContain('cortex-weaver init');
    });

    it('should create feature prototype template with proper structure', async () => {
      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      const featureTemplatePath = path.join(testProjectRoot, 'prototypes', 'features', 'example-feature.md');
      expect(fs.existsSync(featureTemplatePath)).toBe(true);

      const content = fs.readFileSync(featureTemplatePath, 'utf-8');
      expect(content).toContain('# Example Feature Prototype');
      expect(content).toContain('## Overview');
      expect(content).toContain('## Goals');
      expect(content).toContain('## Implementation Notes');
      expect(content).toContain('## Results');
      expect(content).toContain('## Files');
      expect(content).toContain('feature-impl.js');
      expect(content).toContain('feature-test.js');
      expect(content).toContain('Status: In Progress');
    });

    it('should create experiment template with scientific structure', async () => {
      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      const experimentTemplatePath = path.join(testProjectRoot, 'prototypes', 'experiments', 'example-experiment.md');
      expect(fs.existsSync(experimentTemplatePath)).toBe(true);

      const content = fs.readFileSync(experimentTemplatePath, 'utf-8');
      expect(content).toContain('# Example Experiment');
      expect(content).toContain('## Hypothesis');
      expect(content).toContain('## Experiment Design');
      expect(content).toContain('## Data Collection');
      expect(content).toContain('## Results');
      expect(content).toContain('Independent variables');
      expect(content).toContain('Success criteria');
      expect(content).toContain('Status: Planning');
    });

    it('should create proof-of-concept template with technical focus', async () => {
      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      const pocTemplatePath = path.join(testProjectRoot, 'prototypes', 'proofs-of-concept', 'example-poc.md');
      expect(fs.existsSync(pocTemplatePath)).toBe(true);

      const content = fs.readFileSync(pocTemplatePath, 'utf-8');
      expect(content).toContain('# Example Proof of Concept');
      expect(content).toContain('## Objective');
      expect(content).toContain('## Success Criteria');
      expect(content).toContain('## Technical Approach');
      expect(content).toContain('## Production Readiness');
      expect(content).toContain('Scaling considerations');
      expect(content).toContain('Security implications');
      expect(content).toContain('Status: Concept');
    });

    it('should create spike solution template with time-boxed structure', async () => {
      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      const spikeTemplatePath = path.join(testProjectRoot, 'prototypes', 'spike-solutions', 'example-spike.md');
      expect(fs.existsSync(spikeTemplatePath)).toBe(true);

      const content = fs.readFileSync(spikeTemplatePath, 'utf-8');
      expect(content).toContain('# Example Spike Solution');
      expect(content).toContain('## Research Question');
      expect(content).toContain('## Time Box');
      expect(content).toContain('## Investigation Scope');
      expect(content).toContain('## Decision');
      expect(content).toContain('Start date');
      expect(content).toContain('Go/No-go decision');
      expect(content).toContain('Time-boxed investigation');
    });

    it('should create algorithm template with executable JavaScript', async () => {
      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      const algorithmTemplatePath = path.join(testProjectRoot, 'prototypes', 'algorithms', 'example-algorithm.js');
      expect(fs.existsSync(algorithmTemplatePath)).toBe(true);

      const content = fs.readFileSync(algorithmTemplatePath, 'utf-8');
      
      // Check for JavaScript structure
      expect(content).toContain('function exampleSort(arr)');
      expect(content).toContain('function performanceTest(algorithm, testData)');
      expect(content).toContain('function runTests()');
      expect(content).toContain('function isSorted(arr)');
      
      // Check for documentation
      expect(content).toContain('Example Algorithm Prototype');
      expect(content).toContain('@param');
      expect(content).toContain('@returns');
      
      // Check for test cases
      expect(content).toContain('testCases');
      expect(content).toContain('[3, 1, 4, 1, 5, 9, 2, 6]');
      
      // Check for exports
      expect(content).toContain('module.exports');
      expect(content).toContain('exampleSort');
      expect(content).toContain('performanceTest');
    });

    it('should not overwrite existing files', async () => {
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      fs.mkdirSync(prototypesPath, { recursive: true });
      
      // Create existing README
      const existingReadme = 'Existing README content';
      const readmePath = path.join(prototypesPath, 'README.md');
      fs.writeFileSync(readmePath, existingReadme);

      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      // Verify existing README is preserved
      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toBe(existingReadme);

      // Verify new directories are still created
      expect(fs.existsSync(path.join(prototypesPath, 'features'))).toBe(true);
      expect(fs.existsSync(path.join(prototypesPath, 'algorithms'))).toBe(true);
    });

    it('should not overwrite existing template files', async () => {
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      const featuresPath = path.join(prototypesPath, 'features');
      fs.mkdirSync(featuresPath, { recursive: true });
      
      // Create existing template
      const existingTemplate = 'Existing feature template';
      const templatePath = path.join(featuresPath, 'example-feature.md');
      fs.writeFileSync(templatePath, existingTemplate);

      await CLITemplates.createPrototypesDirectory(testProjectRoot);

      // Verify existing template is preserved
      const content = fs.readFileSync(templatePath, 'utf-8');
      expect(content).toBe(existingTemplate);
    });

    it('should handle directory creation when prototypes already exists', async () => {
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      fs.mkdirSync(prototypesPath);

      // Should not throw error
      await expect(CLITemplates.createPrototypesDirectory(testProjectRoot)).resolves.not.toThrow();

      // Should still create subdirectories
      expect(fs.existsSync(path.join(prototypesPath, 'features'))).toBe(true);
      expect(fs.existsSync(path.join(prototypesPath, 'algorithms'))).toBe(true);
    });
  });

  describe('createPrototypesReadme', () => {
    it('should create standalone README when called directly', async () => {
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      fs.mkdirSync(prototypesPath, { recursive: true });

      await CLITemplates.createPrototypesReadme(prototypesPath);

      const readmePath = path.join(prototypesPath, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('CortexWeaver Prototypes Directory');
    });

    it('should not overwrite existing README when called directly', async () => {
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      fs.mkdirSync(prototypesPath, { recursive: true });

      const existingContent = 'Existing README';
      const readmePath = path.join(prototypesPath, 'README.md');
      fs.writeFileSync(readmePath, existingContent);

      await CLITemplates.createPrototypesReadme(prototypesPath);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toBe(existingContent);
    });
  });

  describe('createPrototypeTemplates', () => {
    it('should create all template files when called directly', async () => {
      const prototypesPath = path.join(testProjectRoot, 'prototypes');
      
      // Create all required subdirectories
      const subdirs = [
        'features', 'experiments', 'proofs-of-concept', 
        'spike-solutions', 'algorithms'
      ];
      
      subdirs.forEach(subdir => {
        fs.mkdirSync(path.join(prototypesPath, subdir), { recursive: true });
      });

      await CLITemplates.createPrototypeTemplates(prototypesPath);

      // Verify all templates exist
      const expectedTemplates = [
        'features/example-feature.md',
        'experiments/example-experiment.md',
        'proofs-of-concept/example-poc.md',
        'spike-solutions/example-spike.md',
        'algorithms/example-algorithm.js'
      ];

      expectedTemplates.forEach(template => {
        const templatePath = path.join(prototypesPath, template);
        expect(fs.existsSync(templatePath)).toBe(true);
        
        const content = fs.readFileSync(templatePath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
      });
    });
  });
});