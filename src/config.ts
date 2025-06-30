import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export interface ProjectConfig {
  models: {
    claude: string;
    gemini: string;
  };
  costs: {
    claudeTokenCost: number;
    geminiTokenCost: number;
  };
  budget: {
    maxTokens: number;
    maxCost: number;
  };
}

export class ConfigService {
  private projectRoot: string;
  private envFilePath: string;
  private configFilePath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.envFilePath = path.join(projectRoot, '.env');
    this.configFilePath = path.join(projectRoot, '.cortexweaver', 'config.json');
  }

  loadEnvironmentVariables(): { [key: string]: string } {
    if (!fs.existsSync(this.envFilePath)) {
      return {};
    }

    const envConfig = dotenv.parse(fs.readFileSync(this.envFilePath));
    return envConfig;
  }

  loadProjectConfig(): ProjectConfig {
    const defaultConfig: ProjectConfig = {
      models: {
        claude: 'claude-3-opus-20240229',
        gemini: 'gemini-pro'
      },
      costs: {
        claudeTokenCost: 0.015,
        geminiTokenCost: 0.0005
      },
      budget: {
        maxTokens: 50000,
        maxCost: 500
      }
    };

    if (!fs.existsSync(this.configFilePath)) {
      return defaultConfig;
    }

    try {
      const configContent = fs.readFileSync(this.configFilePath, 'utf-8');
      const config = JSON.parse(configContent);
      
      return {
        models: { ...defaultConfig.models, ...config.models },
        costs: { ...defaultConfig.costs, ...config.costs },
        budget: { ...defaultConfig.budget, ...config.budget }
      };
    } catch (error) {
      console.warn(`Failed to parse config file: ${error}. Using default configuration.`);
      return defaultConfig;
    }
  }

  getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
  }

  saveProjectConfig(config: ProjectConfig): void {
    const configDir = path.dirname(this.configFilePath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2));
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getCortexWeaverDir(): string {
    return path.join(this.projectRoot, '.cortexweaver');
  }
}