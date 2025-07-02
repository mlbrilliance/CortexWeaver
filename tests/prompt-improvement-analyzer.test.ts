import { PromptAnalyzer, DiffAnalysis, ContentValidation } from '../src/prompt-improvement/analyzer';
import * as fs from 'fs';
import * as path from 'path';

describe('PromptAnalyzer', () => {
  let analyzer: PromptAnalyzer;

  beforeEach(() => {
    analyzer = new PromptAnalyzer();
  });

  describe('generateUnifiedDiff', () => {
    it('should return empty string for identical content', async () => {
      const original = 'Hello World';
      const improved = 'Hello World';
      const filename = 'test.txt';

      const result = await analyzer.generateUnifiedDiff(original, improved, filename);
      
      expect(result).toBe('');
    });

    it('should generate diff for different content', async () => {
      const original = 'Hello World\nThis is a test';
      const improved = 'Hello Universe\nThis is a test';
      const filename = 'test.txt';

      const result = await analyzer.generateUnifiedDiff(original, improved, filename);
      
      expect(result).toContain('--- test.txt');
      expect(result).toContain('+++ test.txt');
      expect(result).toContain('-Hello World');
      expect(result).toContain('+Hello Universe');
    });

    it('should handle empty content', async () => {
      const original = '';
      const improved = 'New content';
      const filename = 'test.txt';

      const result = await analyzer.generateUnifiedDiff(original, improved, filename);
      
      expect(result).toContain('--- test.txt');
      expect(result).toContain('+++ test.txt');
      expect(result).toContain('+New content');
    });

    it('should handle multiline changes', async () => {
      const original = 'Line 1\nLine 2\nLine 3\nLine 4';
      const improved = 'Line 1\nModified Line 2\nLine 3\nLine 4';
      const filename = 'multiline.txt';

      const result = await analyzer.generateUnifiedDiff(original, improved, filename);
      
      expect(result).toContain('--- multiline.txt');
      expect(result).toContain('+++ multiline.txt');
      expect(result).toContain('-Line 2');
      expect(result).toContain('+Modified Line 2');
    });

    it('should handle content with only additions', async () => {
      const original = 'Original line';
      const improved = 'Original line\nNew line';
      const filename = 'additions.txt';

      const result = await analyzer.generateUnifiedDiff(original, improved, filename);
      
      expect(result).toContain('--- additions.txt');
      expect(result).toContain('+++ additions.txt');
      expect(result).toContain('+New line');
    });

    it('should handle content with only deletions', async () => {
      const original = 'Line to keep\nLine to delete';
      const improved = 'Line to keep';
      const filename = 'deletions.txt';

      const result = await analyzer.generateUnifiedDiff(original, improved, filename);
      
      expect(result).toContain('--- deletions.txt');
      expect(result).toContain('+++ deletions.txt');
      expect(result).toContain('-Line to delete');
    });
  });

  describe('analyzeDiff', () => {
    it('should analyze simple diff correctly', () => {
      const diff = `--- test.txt
+++ test.txt
@@ -1,2 +1,2 @@
 Line 1
-Old line
+New line`;

      const result = analyzer.analyzeDiff(diff);

      expect(result.addedLines).toBe(1);
      expect(result.removedLines).toBe(1);
      expect(result.modifiedLines).toBe(1);
      expect(result.complexity).toBe('low');
      expect(result.hasStructuralChanges).toBe(false);
    });

    it('should detect high complexity with many changes', () => {
      const diff = Array.from({ length: 25 }, (_, i) => `+Added line ${i}`).join('\n');

      const result = analyzer.analyzeDiff(diff);

      expect(result.addedLines).toBe(25);
      expect(result.complexity).toBe('high');
    });

    it('should detect medium complexity', () => {
      const diff = Array.from({ length: 10 }, (_, i) => `+Added line ${i}`).join('\n');

      const result = analyzer.analyzeDiff(diff);

      expect(result.addedLines).toBe(10);
      expect(result.complexity).toBe('medium');
    });

    it('should detect structural changes with headers', () => {
      const diff = `--- test.md
+++ test.md
@@ -1,2 +1,2 @@
-# Old Header
+## New Header`;

      const result = analyzer.analyzeDiff(diff);

      expect(result.hasStructuralChanges).toBe(true);
      expect(result.complexity).toBe('high');
    });

    it('should detect structural changes with code blocks', () => {
      const diff = `--- test.md
+++ test.md
@@ -1,2 +1,2 @@
-Old text
+\`\`\`javascript
+console.log('hello');
+\`\`\``;

      const result = analyzer.analyzeDiff(diff);

      expect(result.hasStructuralChanges).toBe(true);
    });

    it('should ignore header lines in diff format', () => {
      const diff = `--- original.txt
+++ improved.txt
@@ -1,3 +1,3 @@
+Added line
-Removed line`;

      const result = analyzer.analyzeDiff(diff);

      expect(result.addedLines).toBe(1);
      expect(result.removedLines).toBe(1);
    });

    it('should handle empty diff', () => {
      const diff = '';

      const result = analyzer.analyzeDiff(diff);

      expect(result.addedLines).toBe(0);
      expect(result.removedLines).toBe(0);
      expect(result.modifiedLines).toBe(0);
      expect(result.complexity).toBe('low');
      expect(result.hasStructuralChanges).toBe(false);
    });
  });

  describe('validateContent', () => {
    it('should validate content with changes', () => {
      const original = 'Original content';
      const improved = 'Improved content';

      const result = analyzer.validateContent(original, improved);

      expect(result.isValid).toBe(true);
      expect(result.hasContent).toBe(true);
      expect(result.hasChanges).toBe(true);
      expect(result.estimatedImpact).toBe('minimal');
    });

    it('should detect no changes', () => {
      const content = 'Same content';

      const result = analyzer.validateContent(content, content);

      expect(result.isValid).toBe(true);
      expect(result.hasContent).toBe(true);
      expect(result.hasChanges).toBe(false);
      expect(result.estimatedImpact).toBe('minimal');
    });

    it('should detect empty content', () => {
      const result = analyzer.validateContent('', '');

      expect(result.isValid).toBe(false);
      expect(result.hasContent).toBe(false);
      expect(result.hasChanges).toBe(false);
    });

    it('should detect moderate impact changes', () => {
      const original = 'Short text';
      const improved = 'This is a much longer text that represents a moderate change in content length';

      const result = analyzer.validateContent(original, improved);

      expect(result.estimatedImpact).toBe('moderate');
    });

    it('should detect significant impact changes', () => {
      const original = 'Short';
      const improved = 'This is a significantly longer text that represents a major change in content length and structure, adding substantial new information and context';

      const result = analyzer.validateContent(original, improved);

      expect(result.estimatedImpact).toBe('significant');
    });

    it('should handle whitespace-only content', () => {
      const original = '   ';
      const improved = '\t\n';

      const result = analyzer.validateContent(original, improved);

      expect(result.isValid).toBe(false);
      expect(result.hasContent).toBe(false);
    });
  });

  describe('applyDiffToContent', () => {
    it('should apply simple additions', () => {
      const original = 'Line 1\nLine 2';
      const diff = `--- test.txt
+++ test.txt
+Added line`;

      const result = analyzer.applyDiffToContent(original, diff);

      expect(result).toContain('Added line');
    });

    it('should apply simple removals', () => {
      const original = 'Line 1\nLine to remove\nLine 3';
      const diff = `--- test.txt
+++ test.txt
-Line to remove`;

      const result = analyzer.applyDiffToContent(original, diff);

      expect(result).not.toContain('Line to remove');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 3');
    });

    it('should handle mixed additions and removals', () => {
      const original = 'Keep this\nRemove this\nKeep this too';
      const diff = `--- test.txt
+++ test.txt
-Remove this
+Add this`;

      const result = analyzer.applyDiffToContent(original, diff);

      expect(result).not.toContain('Remove this');
      expect(result).toContain('Add this');
      expect(result).toContain('Keep this');
    });

    it('should ignore diff header lines', () => {
      const original = 'Original content';
      const diff = `--- original.txt
+++ improved.txt
@@ -1,1 +1,2 @@
+New line`;

      const result = analyzer.applyDiffToContent(original, diff);

      expect(result).toContain('Original content');
      expect(result).toContain('New line');
      expect(result).not.toContain('---');
      expect(result).not.toContain('+++');
    });

    it('should handle empty diff', () => {
      const original = 'Original content';
      const diff = '';

      const result = analyzer.applyDiffToContent(original, diff);

      expect(result).toBe(original);
    });

    it('should handle non-existent lines in removal', () => {
      const original = 'Line 1\nLine 2';
      const diff = `--- test.txt
+++ test.txt
-Non-existent line`;

      const result = analyzer.applyDiffToContent(original, diff);

      // Should not crash and preserve original content
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
    });
  });

  describe('extractContentMetrics', () => {
    it('should extract basic metrics correctly', () => {
      const content = 'Hello world\nThis is a test';

      const result = analyzer.extractContentMetrics(content);

      expect(result.wordCount).toBe(6);
      expect(result.lineCount).toBe(2);
      expect(result.characterCount).toBe(25);
      expect(result.hasInstructions).toBe(false);
      expect(result.hasExamples).toBe(false);
      expect(result.hasConstraints).toBe(false);
    });

    it('should detect instructions', () => {
      const content = 'You should complete this task. Please follow the instructions.';

      const result = analyzer.extractContentMetrics(content);

      expect(result.hasInstructions).toBe(true);
    });

    it('should detect examples', () => {
      const content = 'For example, you can do this. Such as in this instance.';

      const result = analyzer.extractContentMetrics(content);

      expect(result.hasExamples).toBe(true);
    });

    it('should detect constraints', () => {
      const content = "Don't do this. Always follow rules. Never break constraints.";

      const result = analyzer.extractContentMetrics(content);

      expect(result.hasConstraints).toBe(true);
    });

    it('should handle various instruction patterns', () => {
      const patterns = [
        'You must complete this',
        'You need to do this',
        'You will perform this',
        'Instructions: Follow these steps',
        'Please ensure that'
      ];

      patterns.forEach(pattern => {
        const result = analyzer.extractContentMetrics(pattern);
        expect(result.hasInstructions).toBe(true);
      });
    });

    it('should handle various example patterns', () => {
      const patterns = [
        'Example: This is how you do it',
        'Examples include the following',
        'For instance, consider this',
        'Such as this method'
      ];

      patterns.forEach(pattern => {
        const result = analyzer.extractContentMetrics(pattern);
        expect(result.hasExamples).toBe(true);
      });
    });

    it('should handle various constraint patterns', () => {
      const patterns = [
        "Don't exceed the limit",
        'Do not attempt this',
        'Avoid using this method',
        'Never ignore the rules',
        'Always check the results',
        'Constraints: Must be positive',
        'Limits apply to this function'
      ];

      patterns.forEach(pattern => {
        const result = analyzer.extractContentMetrics(pattern);
        expect(result.hasConstraints).toBe(true);
      });
    });

    it('should handle empty content', () => {
      const result = analyzer.extractContentMetrics('');

      expect(result.wordCount).toBe(0);
      expect(result.lineCount).toBe(1);
      expect(result.characterCount).toBe(0);
      expect(result.hasInstructions).toBe(false);
      expect(result.hasExamples).toBe(false);
      expect(result.hasConstraints).toBe(false);
    });

    it('should handle whitespace-only content', () => {
      const result = analyzer.extractContentMetrics('   \n\t  \n  ');

      expect(result.wordCount).toBe(0);
      expect(result.lineCount).toBe(3);
      expect(result.characterCount).toBe(11);
    });

    it('should count lines correctly with different line endings', () => {
      const content = 'Line 1\nLine 2\r\nLine 3\n';

      const result = analyzer.extractContentMetrics(content);

      expect(result.lineCount).toBe(4); // Split by \n creates 4 parts
    });
  });

  describe('compareContentMetrics', () => {
    it('should compare basic metrics', () => {
      const original = 'Short text';
      const improved = 'Much longer and improved text with more words';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.wordCountDelta).toBe(6); // 8 - 2
      expect(result.characterCountDelta).toBeGreaterThan(0);
      expect(result.lineCountDelta).toBe(0); // Both single line
    });

    it('should detect added instructions', () => {
      const original = 'Regular text';
      const improved = 'You should follow these instructions carefully';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.structuralChanges).toContain('Added instructions');
      expect(result.improvementIndicators).toEqual([]);
    });

    it('should detect removed instructions', () => {
      const original = 'You must complete this task';
      const improved = 'Complete this task';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.structuralChanges).toContain('Removed instructions');
    });

    it('should detect added examples', () => {
      const original = 'Basic explanation';
      const improved = 'Basic explanation with examples like this one';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.structuralChanges).toContain('Added examples');
      expect(result.improvementIndicators).toContain('Added examples for clarity');
    });

    it('should detect removed examples', () => {
      const original = 'Text with example: sample';
      const improved = 'Text without sample';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.structuralChanges).toContain('Removed examples');
    });

    it('should detect added constraints', () => {
      const original = 'Free form text';
      const improved = "Text with constraints: don't exceed limits";

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.structuralChanges).toContain('Added constraints');
      expect(result.improvementIndicators).toContain('Added constraints for better control');
    });

    it('should detect removed constraints', () => {
      const original = "Text with limits: don't do this";
      const improved = 'Text without limits';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.structuralChanges).toContain('Removed constraints');
    });

    it('should detect helpful detail addition', () => {
      const original = 'Short text';
      const improved = 'Short text with helpful additional context';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.improvementIndicators).toContain('Added helpful detail while maintaining conciseness');
    });

    it('should not detect helpful detail for excessive additions', () => {
      const original = 'Short';
      const improved = 'Short text that has been expanded far beyond reasonable limits with excessive verbosity and unnecessary additions that make it overly long';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.improvementIndicators).not.toContain('Added helpful detail while maintaining conciseness');
    });

    it('should handle identical content', () => {
      const content = 'Same content for both';

      const result = analyzer.compareContentMetrics(content, content);

      expect(result.wordCountDelta).toBe(0);
      expect(result.lineCountDelta).toBe(0);
      expect(result.characterCountDelta).toBe(0);
      expect(result.structuralChanges).toEqual([]);
      expect(result.improvementIndicators).toEqual([]);
    });

    it('should detect multiple structural changes', () => {
      const original = 'Simple text';
      const improved = 'You should follow this example: sample text. Never ignore constraints.';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.structuralChanges).toContain('Added instructions');
      expect(result.structuralChanges).toContain('Added examples');
      expect(result.structuralChanges).toContain('Added constraints');
      expect(result.improvementIndicators).toContain('Added examples for clarity');
      expect(result.improvementIndicators).toContain('Added constraints for better control');
    });

    it('should handle negative word count delta', () => {
      const original = 'This is a very long piece of text with many words';
      const improved = 'Short text';

      const result = analyzer.compareContentMetrics(original, improved);

      expect(result.wordCountDelta).toBeLessThan(0);
      expect(result.characterCountDelta).toBeLessThan(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle special characters in diff generation', async () => {
      const original = 'Text with special chars: @#$%^&*()';
      const improved = 'Text with different special chars: !@#$%';
      const filename = 'special.txt';

      const result = await analyzer.generateUnifiedDiff(original, improved, filename);

      expect(result).toContain('--- special.txt');
      expect(result).toContain('+++ special.txt');
    });

    it('should handle unicode characters', async () => {
      const original = 'Text with unicode: café résumé 中文';
      const improved = 'Text with unicode: café résumé 日本語';
      const filename = 'unicode.txt';

      const result = await analyzer.generateUnifiedDiff(original, improved, filename);

      expect(result).toContain('中文');
      expect(result).toContain('日本語');
    });

    it('should handle very long lines', () => {
      const longLine = 'x'.repeat(10000);
      const content = `Short line\n${longLine}\nAnother short line`;

      const result = analyzer.extractContentMetrics(content);

      expect(result.lineCount).toBe(3);
      expect(result.characterCount).toBe(content.length);
    });

    it('should handle regex special characters in patterns', () => {
      const content = 'Text with regex chars: .*+?^${}()|[]\\';

      const result = analyzer.extractContentMetrics(content);

      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.characterCount).toBe(content.length);
    });
  });
});