import { DockerBaseTemplates } from './docker-base-templates';
import { DockerComposeTemplates } from './docker-compose-templates';
import { KubernetesTemplates } from './kubernetes-templates';

/**
 * DockerTemplates coordinates the creation of Docker-related configuration files
 * Now uses modular approach with specialized template classes
 */
export class DockerTemplates {
  
  static async createDockerCompose(projectRoot: string): Promise<void> {
    return DockerComposeTemplates.createDockerCompose(projectRoot);
  }

  static async createDockerfile(projectRoot: string): Promise<void> {
    return DockerBaseTemplates.createDockerfile(projectRoot);
  }

  static async createDockerIgnore(projectRoot: string): Promise<void> {
    return DockerBaseTemplates.createDockerIgnore(projectRoot);
  }

  static async createDockerComposeOverride(projectRoot: string): Promise<void> {
    return DockerComposeTemplates.createDockerComposeOverride(projectRoot);
  }

  static async createDockerfileDev(projectRoot: string): Promise<void> {
    return DockerBaseTemplates.createDockerfileDev(projectRoot);
  }

  static async createKubernetesTemplates(projectRoot: string): Promise<void> {
    return KubernetesTemplates.createKubernetesTemplates(projectRoot);
  }

  static async createHelmChart(projectRoot: string): Promise<void> {
    return KubernetesTemplates.createHelmChart(projectRoot);
  }
}