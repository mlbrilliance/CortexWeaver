import * as fs from 'fs';
import * as path from 'path';

/**
 * ApiTemplates handles OpenAPI specification templates
 */
export class ApiTemplates {
  
  static async createOpenApiTemplate(apiPath: string): Promise<void> {
    const openApiPath = path.join(apiPath, 'openapi.yaml');
    
    if (fs.existsSync(openApiPath)) {
      return; // Don't overwrite existing OpenAPI spec
    }

    const openApiContent = `openapi: 3.0.3
info:
  title: CortexWeaver Project API
  description: |
    This is a template OpenAPI specification for your CortexWeaver project.
    
    This contract serves as the formal specification for your API, following
    Specification-Driven Development (SDD) principles. AI agents will use this
    contract as their source of truth for implementation and testing.
    
  version: 1.0.0
  contact:
    name: Project Team
    email: team@example.com

servers:
  - url: http://localhost:3000/api/v1
    description: Development server

paths:
  /health:
    get:
      summary: Health check endpoint
      description: Returns the health status of the API
      operationId: getHealth
      tags:
        - Health
      responses:
        '200':
          description: API is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [healthy]
                  timestamp:
                    type: string
                    format: date-time

components:
  schemas:
    ErrorResponse:
      type: object
      required:
        - error
        - message
      properties:
        error:
          type: string
          description: Error code or type
        message:
          type: string
          description: Human-readable error message

tags:
  - name: Health
    description: Health check endpoints`;

    fs.writeFileSync(openApiPath, openApiContent);
  }
}
