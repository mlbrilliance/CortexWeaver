import { EnvTemplates } from './env-templates';
import { ApiTemplates } from './api-templates';
import { SchemaTemplates } from './schema-templates';
import { ContractTemplates } from './contract-templates';

/**
 * ConfigTemplates coordinates the creation of configuration files
 * Now uses modular approach with specialized template classes
 */
export class ConfigTemplates {
  
  static async createEnvTemplate(projectRoot: string): Promise<void> {
    return EnvTemplates.createEnvTemplate(projectRoot);
  }

  static async createOpenApiTemplate(apiPath: string): Promise<void> {
    return ApiTemplates.createOpenApiTemplate(apiPath);
  }

  static async createJsonSchemaTemplates(schemasPath: string): Promise<void> {
    return SchemaTemplates.createJsonSchemaTemplates(schemasPath);
  }

  static async createAdditionalSchemaTemplates(schemasPath: string): Promise<void> {
    return SchemaTemplates.createAdditionalSchemaTemplates(schemasPath);
  }

  static async createContractsDirectory(projectRoot: string): Promise<void> {
    return ContractTemplates.createContractsDirectory(projectRoot);
  }

  static async createGitIgnoreTemplate(projectRoot: string): Promise<void> {
    return EnvTemplates.createGitIgnoreTemplate(projectRoot);
  }
}