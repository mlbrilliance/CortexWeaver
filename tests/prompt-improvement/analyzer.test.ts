import { PromptAnalyzer, DiffAnalysis, ContentValidation } from '../../src/prompt-improvement/analyzer';
import * as fs from 'fs';
import * as path from 'path';

// Mock filesystem operations
jest.mock('fs');
jest.mock('path');

describe('PromptAnalyzer', () => {
  let promptAnalyzer: PromptAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    promptAnalyzer = new PromptAnalyzer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUnifiedDiff', () => {
    it('should generate diff for simple content changes', async () => {
      const originalContent = 'You are an AI assistant.\nHelp users with tasks.';
      const improvedContent = 'You are an advanced AI assistant.\nHelp users with complex tasks efficiently.';
      const filename = 'assistant-prompt.txt';

      const diff = await promptAnalyzer.generateUnifiedDiff(originalContent, improvedContent, filename);

      expect(diff).toContain('--- assistant-prompt.txt');
      expect(diff).toContain('+++ assistant-prompt.txt');
      expect(diff).toContain('-You are an AI assistant.');
      expect(diff).toContain('+You are an advanced AI assistant.');
      expect(diff).toContain('-Help users with tasks.');
      expect(diff).toContain('+Help users with complex tasks efficiently.');
    });

    it('should return empty diff for identical content', async () => {
      const content = 'You are an AI assistant.\nHelp users with tasks.';
      
      const diff = await promptAnalyzer.generateUnifiedDiff(content, content, 'test.txt');

      expect(diff).toBe('');
    });

    it('should handle empty content', async () => {
      const originalContent = '';
      const improvedContent = 'You are an AI assistant.';
      
      const diff = await promptAnalyzer.generateUnifiedDiff(originalContent, improvedContent, 'test.txt');

      expect(diff).toContain('+You are an AI assistant.');
      expect(diff).not.toContain('-');
    });

    it('should handle content removal', async () => {
      const originalContent = 'You are an AI assistant.\nHelp users with tasks.';
      const improvedContent = 'You are an AI assistant.';
      
      const diff = await promptAnalyzer.generateUnifiedDiff(originalContent, improvedContent, 'test.txt');

      expect(diff).toContain('-Help users with tasks.');
      expect(diff).not.toContain('+Help users with tasks.');
    });

    it('should handle multiline additions and deletions', async () => {
      const originalContent = `You are an AI assistant.
Help users with tasks.
Be polite and helpful.`;

      const improvedContent = `You are an advanced AI assistant with specialized capabilities.
Help users with complex tasks efficiently.
Be polite, helpful, and accurate.
Always provide detailed explanations.`;

      const diff = await promptAnalyzer.generateUnifiedDiff(originalContent, improvedContent, 'complex.txt');

      expect(diff).toContain('-You are an AI assistant.');
      expect(diff).toContain('+You are an advanced AI assistant with specialized capabilities.');
      expect(diff).toContain('+Always provide detailed explanations.');
    });

    it('should handle very large content efficiently', async () => {
      const largeContent = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1} content`).join('\n');
      const modifiedContent = largeContent.replace('Line 500 content', 'Line 500 modified content');

      const startTime = Date.now();
      const diff = await promptAnalyzer.generateUnifiedDiff(largeContent, modifiedContent, 'large.txt');
      const endTime = Date.now();

      expect(diff).toContain('-Line 500 content');
      expect(diff).toContain('+Line 500 modified content');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('analyzeDiff', () => {
    it('should analyze simple diff correctly', () => {
      const diff = `--- original.txt
+++ improved.txt
@@ -1,2 +1,2 @@
-You are an AI assistant.
+You are an advanced AI assistant.
 Help users with tasks.`;

      const analysis = promptAnalyzer.analyzeDiff(diff);

      expect(analysis.addedLines).toBe(1);
      expect(analysis.removedLines).toBe(1);
      expect(analysis.modifiedLines).toBe(1);
      expect(analysis.complexity).toBe('low');
      expect(analysis.hasStructuralChanges).toBe(false);
    });

    it('should detect structural changes', () => {
      const diff = `--- original.txt
+++ improved.txt
@@ -1,3 +1,5 @@
 You are an AI assistant.
+
+## Instructions:
 Help users with tasks.
+Please follow these guidelines.`;

      const analysis = promptAnalyzer.analyzeDiff(diff);

      expect(analysis.addedLines).toBe(3);
      expect(analysis.hasStructuralChanges).toBe(true);
      expect(analysis.complexity).toBe('medium');
    });

    it('should classify complexity based on change volume', () => {
      // High complexity diff with many changes
      const largeDiff = Array.from({ length: 50 }, (_, i) => `+New line ${i + 1}`).join('\n');
      const analysis = promptAnalyzer.analyzeDiff(largeDiff);

      expect(analysis.complexity).toBe('high');
      expect(analysis.addedLines).toBe(50);
    });

    it('should handle empty diff', () => {
      const analysis = promptAnalyzer.analyzeDiff('');

      expect(analysis.addedLines).toBe(0);
      expect(analysis.removedLines).toBe(0);
      expect(analysis.modifiedLines).toBe(0);
      expect(analysis.complexity).toBe('low');
      expect(analysis.hasStructuralChanges).toBe(false);
    });

    it('should detect markdown structural elements', () => {
      const markdownDiff = `--- original.txt
+++ improved.txt
@@ -1,1 +1,5 @@
+# Title
+## Subsection
+- List item
+**Bold text**
 Existing content`;

      const analysis = promptAnalyzer.analyzeDiff(markdownDiff);

      expect(analysis.hasStructuralChanges).toBe(true);
      expect(analysis.complexity).toBe('medium');
    });
  });

  describe('validateContent', () => {
    it('should validate normal content', () => {
      const content = 'You are an AI assistant. Help users with their questions.';
      
      const validation = promptAnalyzer.validateContent(content);

      expect(validation.isValid).toBe(true);
      expect(validation.hasContent).toBe(true);
    });

    it('should reject empty content', () => {
      const validation = promptAnalyzer.validateContent('');

      expect(validation.isValid).toBe(false);
      expect(validation.hasContent).toBe(false);
    });

    it('should reject only whitespace content', () => {
      const validation = promptAnalyzer.validateContent('   \n  \t  ');

      expect(validation.isValid).toBe(false);
      expect(validation.hasContent).toBe(false);
    });

    it('should detect content with meaningful changes', () => {
      const originalContent = 'You are an AI assistant.';
      const improvedContent = 'You are an advanced AI assistant with specialized capabilities.';
      
      const validation = promptAnalyzer.validateContentWithChanges(originalContent, improvedContent);

      expect(validation.isValid).toBe(true);
      expect(validation.hasChanges).toBe(true);
      expect(validation.estimatedImpact).toBe('moderate');
    });

    it('should reject content without meaningful changes', () => {
      const originalContent = 'You are an AI assistant.';
      const improvedContent = 'You are an AI assistant.'; // No changes
      
      const validation = promptAnalyzer.validateContentWithChanges(originalContent, improvedContent);

      expect(validation.isValid).toBe(false);
      expect(validation.hasChanges).toBe(false);
    });

    it('should classify impact levels correctly', () => {
      const originalContent = 'You are an AI assistant.';
      
      // Minimal impact - small change
      const minimalChange = 'You are an AI assistant helper.';
      const minimalValidation = promptAnalyzer.validateContentWithChanges(originalContent, minimalChange);
      expect(minimalValidation.estimatedImpact).toBe('minimal');

      // Significant impact - major restructuring
      const significantChange = `You are an advanced AI assistant with the following capabilities:
1. Answer questions accurately
2. Provide detailed explanations
3. Help with complex problem solving
4. Maintain context throughout conversations

Please follow these guidelines when responding...`;
      const significantValidation = promptAnalyzer.validateContentWithChanges(originalContent, significantChange);
      expect(significantValidation.estimatedImpact).toBe('significant');
    });

    it('should handle special characters and unicode', () => {
      const content = 'You are an AI assistant. 你好! Здравствуйте! 🤖';
      
      const validation = promptAnalyzer.validateContent(content);

      expect(validation.isValid).toBe(true);
      expect(validation.hasContent).toBe(true);
    });

    it('should validate very long content', () => {
      const longContent = Array.from({ length: 10000 }, () => 'word').join(' ');
      
      const validation = promptAnalyzer.validateContent(longContent);

      expect(validation.isValid).toBe(true);
      expect(validation.hasContent).toBe(true);
    });
  });

  describe('extractKeywords', () => {
    it('should extract meaningful keywords from prompt content', () => {
      const content = `You are an AI assistant specialized in software development.
Help users with coding tasks, debugging, and best practices.
Provide clear explanations and working code examples.`;

      const keywords = promptAnalyzer.extractKeywords(content);

      expect(keywords).toContain('AI');
      expect(keywords).toContain('assistant');
      expect(keywords).toContain('software');
      expect(keywords).toContain('development');
      expect(keywords).toContain('coding');
      expect(keywords).toContain('debugging');
      expect(keywords.length).toBeGreaterThan(5);
    });

    it('should handle content with no meaningful keywords', () => {
      const content = 'the and or but if when then';
      
      const keywords = promptAnalyzer.extractKeywords(content);

      expect(keywords.length).toBe(0);
    });

    it('should normalize and deduplicate keywords', () => {
      const content = 'AI ai Ai AI development Development DEVELOPMENT';
      
      const keywords = promptAnalyzer.extractKeywords(content);

      expect(keywords).toContain('ai');
      expect(keywords).toContain('development');
      expect(keywords.filter(k => k.toLowerCase() === 'ai').length).toBe(1);
      expect(keywords.filter(k => k.toLowerCase() === 'development').length).toBe(1);
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate similarity between similar prompts', () => {
      const prompt1 = 'You are an AI assistant. Help users with questions.';
      const prompt2 = 'You are an AI assistant. Help users with their questions.';
      
      const similarity = promptAnalyzer.calculateSimilarity(prompt1, prompt2);

      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThanOrEqual(1.0);
    });

    it('should return low similarity for different prompts', () => {
      const prompt1 = 'You are an AI assistant. Help users with questions.';
      const prompt2 = 'You are a chatbot for customer service. Handle complaints.';
      
      const similarity = promptAnalyzer.calculateSimilarity(prompt1, prompt2);

      expect(similarity).toBeLessThan(0.5);
      expect(similarity).toBeGreaterThanOrEqual(0);
    });

    it('should return 1.0 for identical prompts', () => {
      const prompt = 'You are an AI assistant. Help users with questions.';
      
      const similarity = promptAnalyzer.calculateSimilarity(prompt, prompt);

      expect(similarity).toBe(1.0);
    });

    it('should handle empty prompts', () => {
      const similarity1 = promptAnalyzer.calculateSimilarity('', '');
      const similarity2 = promptAnalyzer.calculateSimilarity('content', '');
      
      expect(similarity1).toBe(1.0); // Both empty
      expect(similarity2).toBe(0.0); // One empty
    });
  });

  describe('analyzePromptStructure', () => {
    it('should analyze structured prompt format', () => {
      const prompt = `# System Role
You are an AI assistant.

## Instructions
1. Be helpful
2. Be accurate
3. Be concise

## Examples
User: Hello
Assistant: Hi there!

## Context
This is for general assistance.`;

      const structure = promptAnalyzer.analyzePromptStructure(prompt);

      expect(structure.hasHeaders).toBe(true);
      expect(structure.hasLists).toBe(true);
      expect(structure.hasExamples).toBe(true);
      expect(structure.sectionCount).toBe(4);
      expect(structure.complexity).toBe('high');
    });

    it('should analyze simple unstructured prompt', () => {
      const prompt = 'You are an AI assistant. Help users with their questions.';
      
      const structure = promptAnalyzer.analyzePromptStructure(prompt);

      expect(structure.hasHeaders).toBe(false);
      expect(structure.hasLists).toBe(false);
      expect(structure.hasExamples).toBe(false);
      expect(structure.sectionCount).toBe(1);
      expect(structure.complexity).toBe('low');
    });

    it('should detect various markdown elements', () => {
      const prompt = `**Important:** You are an AI assistant.

- Task 1
- Task 2

> Note: Be careful

\`\`\`example
code block
\`\`\``;

      const structure = promptAnalyzer.analyzePromptStructure(prompt);

      expect(structure.hasLists).toBe(true);
      expect(structure.hasCodeBlocks).toBe(true);
      expect(structure.hasQuotes).toBe(true);
      expect(structure.complexity).toBe('medium');
    });
  });

  describe('generateSuggestions', () => {
    it('should suggest improvements for basic prompts', () => {
      const prompt = 'Help users.';
      
      const suggestions = promptAnalyzer.generateSuggestions(prompt);

      expect(suggestions).toContain('Add more specific role definition');
      expect(suggestions).toContain('Include clear instructions');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest fewer improvements for well-structured prompts', () => {
      const prompt = `# AI Assistant Role
You are an expert AI assistant specialized in helping users.

## Instructions
1. Provide accurate information
2. Be helpful and polite
3. Ask clarifying questions when needed

## Examples
User: How do I code in Python?
Assistant: I'd be happy to help with Python! What specific aspect would you like to learn about?`;

      const suggestions = promptAnalyzer.generateSuggestions(prompt);

      expect(suggestions.length).toBeLessThan(3); // Well-structured prompt needs fewer improvements
    });

    it('should provide specific suggestions based on content analysis', () => {
      const prompt = 'You are helpful.'; // Very basic prompt
      
      const suggestions = promptAnalyzer.generateSuggestions(prompt);

      expect(suggestions.some(s => s.includes('role'))).toBe(true);
      expect(suggestions.some(s => s.includes('specific'))).toBe(true);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => promptAnalyzer.validateContent(null as any)).not.toThrow();
      expect(() => promptAnalyzer.validateContent(undefined as any)).not.toThrow();
      
      const nullValidation = promptAnalyzer.validateContent(null as any);
      expect(nullValidation.isValid).toBe(false);
    });

    it('should handle extremely long inputs', () => {
      const veryLongContent = 'a'.repeat(1000000); // 1MB of text
      
      const startTime = Date.now();
      const validation = promptAnalyzer.validateContent(veryLongContent);
      const endTime = Date.now();

      expect(validation.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle special characters and edge cases in diff', () => {
      const originalContent = 'Line with "quotes" and \n newlines \t tabs';
      const improvedContent = 'Line with \'quotes\' and \r\n different newlines \t\t more tabs';
      
      const diff = await promptAnalyzer.generateUnifiedDiff(originalContent, improvedContent, 'special.txt');

      expect(diff).toBeDefined();
      expect(diff.length).toBeGreaterThan(0);
    });

    it('should handle circular references in content analysis', () => {
      const circularContent = 'This content refers to itself: This content refers to itself';
      
      const validation = promptAnalyzer.validateContent(circularContent);
      const keywords = promptAnalyzer.extractKeywords(circularContent);

      expect(validation.isValid).toBe(true);
      expect(keywords).toBeDefined();
    });
  });

  describe('performance optimization', () => {
    it('should efficiently process multiple diff analyses', () => {
      const diffs = Array.from({ length: 100 }, (_, i) => 
        `--- file${i}.txt\n+++ file${i}.txt\n@@ -1,1 +1,1 @@\n-old content ${i}\n+new content ${i}`
      );

      const startTime = Date.now();
      const analyses = diffs.map(diff => promptAnalyzer.analyzeDiff(diff));
      const endTime = Date.now();

      expect(analyses).toHaveLength(100);
      expect(analyses.every(a => a.addedLines === 1 && a.removedLines === 1)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently validate large batches of content', () => {
      const contents = Array.from({ length: 1000 }, (_, i) => `Content ${i} for validation`);

      const startTime = Date.now();
      const validations = contents.map(content => promptAnalyzer.validateContent(content));
      const endTime = Date.now();

      expect(validations).toHaveLength(1000);
      expect(validations.every(v => v.isValid)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should cache similarity calculations for repeated comparisons', () => {
      const prompt1 = 'You are an AI assistant specialized in coding.';
      const prompt2 = 'You are an AI assistant specialized in development.';

      // First calculation
      const startTime1 = Date.now();
      const similarity1 = promptAnalyzer.calculateSimilarity(prompt1, prompt2);
      const endTime1 = Date.now();

      // Second calculation (should be faster if cached)
      const startTime2 = Date.now();
      const similarity2 = promptAnalyzer.calculateSimilarity(prompt1, prompt2);
      const endTime2 = Date.now();

      expect(similarity1).toBe(similarity2);
      // Second calculation should be faster or same (caching effect)
      expect(endTime2 - startTime2).toBeLessThanOrEqual(endTime1 - startTime1 + 1);
    });
  });
});