import { ContractTemplates } from '../../src/templates/contract-templates';
import { ApiTemplates } from '../../src/templates/api-templates';
import { SchemaTemplates } from '../../src/templates/schema-templates';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../src/templates/api-templates');
jest.mock('../../src/templates/schema-templates');

describe('ContractTemplates', () => {
  const projectRoot = '/test/project';
  const contractsPath = '/test/project/contracts';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock filesystem operations
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    // Mock path operations
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Mock template dependencies
    (ApiTemplates.createOpenApiTemplate as jest.Mock).mockResolvedValue(undefined);
    (SchemaTemplates.createJsonSchemaTemplates as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createContractsDirectory', () => {
    it('should create complete contracts directory structure', async () => {
      await ContractTemplates.createContractsDirectory(projectRoot);

      // Verify all expected directories are created
      const expectedDirs = [
        '/test/project/contracts',
        '/test/project/contracts/api',
        '/test/project/contracts/schemas',
        '/test/project/contracts/schemas/models',
        '/test/project/contracts/schemas/properties',
        '/test/project/contracts/schemas/properties/invariants',
        '/test/project/contracts/examples'
      ];

      expectedDirs.forEach(dir => {
        expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
      });
    });

    it('should not recreate existing directories', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await ContractTemplates.createContractsDirectory(projectRoot);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create API templates in correct location', async () => {
      await ContractTemplates.createContractsDirectory(projectRoot);

      expect(ApiTemplates.createOpenApiTemplate).toHaveBeenCalledWith('/test/project/contracts/api');
    });

    it('should create schema templates in correct location', async () => {
      await ContractTemplates.createContractsDirectory(projectRoot);

      expect(SchemaTemplates.createJsonSchemaTemplates).toHaveBeenCalledWith('/test/project/contracts/schemas');
    });

    it('should create contracts README with proper content', async () => {
      await ContractTemplates.createContractsDirectory(projectRoot);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/project/contracts/README.md',
        expect.stringContaining('# CortexWeaver Contracts')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/project/contracts/README.md',
        expect.stringContaining('OpenAPI specifications')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/test/project/contracts/README.md',
        expect.stringContaining('JSON Schema definitions')
      );
    });

    it('should not overwrite existing README', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => 
        filePath.includes('README.md')
      );

      await ContractTemplates.createContractsDirectory(projectRoot);

      const readmeWriteCalls = (fs.writeFileSync as jest.Mock).mock.calls.filter(call => 
        call[0].includes('README.md')
      );
      expect(readmeWriteCalls).toHaveLength(0);
    });

    it('should handle partial directory creation when some exist', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((dirPath: string) => 
        dirPath === '/test/project/contracts' || dirPath === '/test/project/contracts/api'
      );

      await ContractTemplates.createContractsDirectory(projectRoot);

      // Should only create non-existing directories
      expect(fs.mkdirSync).toHaveBeenCalledTimes(5); // 7 total - 2 existing
    });

    it('should handle filesystem errors gracefully', async () => {
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(ContractTemplates.createContractsDirectory(projectRoot))
        .rejects.toThrow('Permission denied');
    });

    it('should handle API template creation errors', async () => {
      (ApiTemplates.createOpenApiTemplate as jest.Mock).mockRejectedValue(
        new Error('API template error')
      );

      await expect(ContractTemplates.createContractsDirectory(projectRoot))
        .rejects.toThrow('API template error');
    });

    it('should handle schema template creation errors', async () => {
      (SchemaTemplates.createJsonSchemaTemplates as jest.Mock).mockRejectedValue(
        new Error('Schema template error')
      );

      await expect(ContractTemplates.createContractsDirectory(projectRoot))
        .rejects.toThrow('Schema template error');
    });
  });

  describe('generateContractBoilerplate', () => {
    it('should generate basic contract structure', async () => {
      const contractName = 'UserManagement';
      const options = {
        includeApi: true,
        includeSchema: true,
        includeExamples: true
      };

      await ContractTemplates.generateContractBoilerplate(contractName, contractsPath, options);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('user-management.md'),
        expect.stringContaining('# UserManagement Contract')
      );
    });

    it('should create API specification when requested', async () => {
      const contractName = 'UserService';
      const options = { includeApi: true };

      await ContractTemplates.generateContractBoilerplate(contractName, contractsPath, options);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('user-service-api.yaml'),
        expect.stringContaining('openapi: 3.0.0')
      );
    });

    it('should create JSON schema when requested', async () => {
      const contractName = 'DataModel';
      const options = { includeSchema: true };

      await ContractTemplates.generateContractBoilerplate(contractName, contractsPath, options);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('data-model-schema.json'),
        expect.stringContaining('"$schema"')
      );
    });

    it('should create examples when requested', async () => {
      const contractName = 'PaymentService';
      const options = { includeExamples: true };

      await ContractTemplates.generateContractBoilerplate(contractName, contractsPath, options);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('payment-service-examples.md'),
        expect.stringContaining('# PaymentService Examples')
      );
    });

    it('should handle minimal contract generation', async () => {
      const contractName = 'MinimalContract';
      const options = {};

      await ContractTemplates.generateContractBoilerplate(contractName, contractsPath, options);

      // Should only create basic contract file
      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toContain('minimal-contract.md');
    });

    it('should normalize contract names properly', async () => {
      const contractName = 'Complex Contract Name With Spaces';
      const options = { includeApi: true };

      await ContractTemplates.generateContractBoilerplate(contractName, contractsPath, options);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('complex-contract-name-with-spaces'),
        expect.anything()
      );
    });
  });

  describe('validateContractStructure', () => {
    it('should validate complete contract structure', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockImplementation((dirPath: string) => {
        if (dirPath.includes('api')) return ['openapi.yaml'];
        if (dirPath.includes('schemas')) return ['models', 'properties'];
        if (dirPath.includes('examples')) return ['user-examples.md'];
        return [];
      });

      const validation = await ContractTemplates.validateContractStructure(contractsPath);

      expect(validation.isValid).toBe(true);
      expect(validation.hasApiSpecs).toBe(true);
      expect(validation.hasSchemas).toBe(true);
      expect(validation.hasExamples).toBe(true);
      expect(validation.missingComponents).toHaveLength(0);
    });

    it('should detect missing components', async () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => 
        !filePath.includes('api') && !filePath.includes('examples')
      );

      const validation = await ContractTemplates.validateContractStructure(contractsPath);

      expect(validation.isValid).toBe(false);
      expect(validation.hasApiSpecs).toBe(false);
      expect(validation.hasExamples).toBe(false);
      expect(validation.missingComponents).toContain('api directory');
      expect(validation.missingComponents).toContain('examples directory');
    });

    it('should check for required files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      const validation = await ContractTemplates.validateContractStructure(contractsPath);

      expect(validation.warnings).toContain('No API specifications found');
      expect(validation.warnings).toContain('No schema files found');
    });

    it('should handle non-existent contracts directory', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const validation = await ContractTemplates.validateContractStructure(contractsPath);

      expect(validation.isValid).toBe(false);
      expect(validation.missingComponents).toContain('contracts directory');
    });
  });

  describe('migrateContractsStructure', () => {
    it('should migrate from old to new structure', async () => {
      const oldStructure = {
        hasOldApiFiles: true,
        hasOldSchemaFiles: true
      };

      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => 
        filePath.includes('old-api.json') || filePath.includes('old-schema.json')
      );

      (fs.readdirSync as jest.Mock).mockReturnValue(['old-api.json', 'old-schema.json']);
      (fs.readFileSync as jest.Mock).mockReturnValue('{}');

      await ContractTemplates.migrateContractsStructure(contractsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('api'),
        { recursive: true }
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('openapi.yaml'),
        expect.anything()
      );
    });

    it('should backup old files during migration', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['legacy-contract.json']);
      (fs.readFileSync as jest.Mock).mockReturnValue('{}');

      await ContractTemplates.migrateContractsStructure(contractsPath);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('backup'),
        { recursive: true }
      );
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should handle migration errors gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Read error');
      });

      await expect(ContractTemplates.migrateContractsStructure(contractsPath))
        .rejects.toThrow('Read error');
    });
  });

  describe('integration with other templates', () => {
    it('should coordinate with API templates properly', async () => {
      await ContractTemplates.createContractsDirectory(projectRoot);

      expect(ApiTemplates.createOpenApiTemplate).toHaveBeenCalledWith(
        '/test/project/contracts/api'
      );
    });

    it('should coordinate with schema templates properly', async () => {
      await ContractTemplates.createContractsDirectory(projectRoot);

      expect(SchemaTemplates.createJsonSchemaTemplates).toHaveBeenCalledWith(
        '/test/project/contracts/schemas'
      );
    });

    it('should handle template dependency failures', async () => {
      (ApiTemplates.createOpenApiTemplate as jest.Mock).mockRejectedValue(
        new Error('API template failed')
      );

      await expect(ContractTemplates.createContractsDirectory(projectRoot))
        .rejects.toThrow('API template failed');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty project root', async () => {
      await expect(ContractTemplates.createContractsDirectory(''))
        .rejects.toThrow();
    });

    it('should handle null/undefined inputs', async () => {
      await expect(ContractTemplates.createContractsDirectory(null as any))
        .rejects.toThrow();
    });

    it('should handle filesystem permission errors', async () => {
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      await expect(ContractTemplates.createContractsDirectory(projectRoot))
        .rejects.toThrow('EACCES: permission denied');
    });

    it('should handle disk space errors', async () => {
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      await expect(ContractTemplates.createContractsDirectory(projectRoot))
        .rejects.toThrow('ENOSPC: no space left on device');
    });

    it('should handle concurrent directory creation', async () => {
      let callCount = 0;
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('EEXIST: file already exists');
        }
        return undefined;
      });

      // Should handle race condition gracefully
      await ContractTemplates.createContractsDirectory(projectRoot);
    });
  });

  describe('performance and optimization', () => {
    it('should complete directory creation within reasonable time', async () => {
      const startTime = Date.now();
      
      await ContractTemplates.createContractsDirectory(projectRoot);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should efficiently handle large contract structures', async () => {
      const largeProjectRoot = '/test/large-project';
      
      const startTime = Date.now();
      await ContractTemplates.createContractsDirectory(largeProjectRoot);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should be efficient
    });

    it('should minimize filesystem calls when directories exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await ContractTemplates.createContractsDirectory(projectRoot);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledTimes(8); // 7 dirs + 1 README
    });
  });
});