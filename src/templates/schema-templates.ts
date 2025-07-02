import * as fs from 'fs';
import * as path from 'path';

/**
 * SchemaTemplates handles JSON Schema and contract templates
 */
export class SchemaTemplates {
  
  static async createJsonSchemaTemplates(schemasPath: string): Promise<void> {
    // Ensure the models directory exists
    const modelsPath = path.join(schemasPath, 'models');
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }

    const userSchemaPath = path.join(modelsPath, 'user.schema.json');
    
    if (fs.existsSync(userSchemaPath)) {
      return; // Don't overwrite existing schema
    }

    const userSchemaContent = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/schemas/user.schema.json",
  "title": "User",
  "description": "User entity schema for CortexWeaver project",
  "type": "object",
  "required": [
    "id",
    "email",
    "firstName",
    "lastName",
    "createdAt"
  ],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for the user"
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "User's email address"
    },
    "firstName": {
      "type": "string",
      "description": "User's first name",
      "minLength": 1,
      "maxLength": 50
    },
    "lastName": {
      "type": "string",
      "description": "User's last name",
      "minLength": 1,
      "maxLength": 50
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp when the user was created"
    }
  },
  "additionalProperties": false
}`;

    fs.writeFileSync(userSchemaPath, userSchemaContent);

    // Create additional schema templates
    await this.createAdditionalSchemaTemplates(schemasPath);
  }

  static async createAdditionalSchemaTemplates(schemasPath: string): Promise<void> {
    // Create property invariants template
    const propertiesPath = path.join(schemasPath, 'properties', 'invariants');
    if (!fs.existsSync(propertiesPath)) {
      fs.mkdirSync(propertiesPath, { recursive: true });
    }

    const authPropertiesPath = path.join(propertiesPath, 'auth.properties.ts');
    if (!fs.existsSync(authPropertiesPath)) {
      const authPropertiesContent = `/**
 * Authentication Property-Based Test Invariants
 * These properties define the behavioral contracts for authentication
 */

export interface AuthProperties {
  // User registration properties
  userRegistrationIsIdempotent: boolean;
  emailMustBeUnique: boolean;
  passwordMustBeHashed: boolean;
  
  // Authentication properties
  validCredentialsReturnToken: boolean;
  invalidCredentialsRejectAccess: boolean;
  tokenExpirationIsRespected: boolean;
  
  // Security properties
  passwordsAreNeverLoggedOrReturned: boolean;
  tokensAreSecurelyGenerated: boolean;
  bruteForceAttacksAreThrottled: boolean;
}

/**
 * Property-based test generators for authentication
 */
export const authTestProperties = {
  // Generate valid user data
  validUserData: () => ({
    email: generateValidEmail(),
    password: generateSecurePassword(),
    firstName: generateValidName(),
    lastName: generateValidName()
  }),
  
  // Generate invalid user data variations
  invalidUserData: () => ({
    email: generateInvalidEmail(),
    password: generateWeakPassword(),
    firstName: '',
    lastName: ''
  }),
  
  // Test invariants
  invariants: {
    emailUniqueness: 'No two users can have the same email address',
    passwordSecurity: 'Passwords must be hashed with bcrypt and salt',
    tokenSecurity: 'JWT tokens must be signed and have expiration',
    accessControl: 'Invalid credentials must never grant access'
  }
};

// Helper functions (to be implemented)
function generateValidEmail(): string {
  // Implementation for generating valid test emails
  return 'test@example.com';
}

function generateInvalidEmail(): string {
  // Implementation for generating invalid test emails
  return 'invalid-email';
}

function generateSecurePassword(): string {
  // Implementation for generating secure test passwords
  return 'SecurePass123!';
}

function generateWeakPassword(): string {
  // Implementation for generating weak test passwords
  return '123';
}

function generateValidName(): string {
  // Implementation for generating valid test names
  return 'TestName';
}`;

      fs.writeFileSync(authPropertiesPath, authPropertiesContent);
    }

    // Create examples directory and templates
    const examplesPath = path.join(schemasPath, 'examples');
    if (!fs.existsSync(examplesPath)) {
      fs.mkdirSync(examplesPath, { recursive: true });
    }

    const userExamplesPath = path.join(examplesPath, 'user-examples.json');
    if (!fs.existsSync(userExamplesPath)) {
      const userExamplesContent = `{
  "validUsers": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2024-01-01T12:00:00Z"
    },
    {
      "id": "987fcdeb-51a2-43d1-b2c3-123456789abc",
      "email": "jane.smith@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "createdAt": "2024-01-02T14:30:00Z"
    }
  ],
  "invalidUsers": [
    {
      "description": "Missing required field 'id'",
      "data": {
        "email": "missing.id@example.com",
        "firstName": "Missing",
        "lastName": "ID",
        "createdAt": "2024-01-01T12:00:00Z"
      }
    },
    {
      "description": "Invalid email format",
      "data": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "email": "invalid-email",
        "firstName": "Invalid",
        "lastName": "Email",
        "createdAt": "2024-01-01T12:00:00Z"
      }
    },
    {
      "description": "Name too long",
      "data": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "email": "toolong@example.com",
        "firstName": "ThisNameIsTooLongAndExceedsTheFiftyCharacterLimit",
        "lastName": "LastName",
        "createdAt": "2024-01-01T12:00:00Z"
      }
    }
  ]
}`;

      fs.writeFileSync(userExamplesPath, userExamplesContent);
    }
  }
}
