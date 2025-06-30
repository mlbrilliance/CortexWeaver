import { Agent } from '../agent';

export interface PropertyInvariant {
  name: string;
  description: string;
  applicableMethods: string[];
  generators: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface GeneratorStrategy {
  parameterName: string;
  parameterType: string;
  generator: string;
  constraints: string[];
  edgeCases: string[];
}

export interface TestQualityValidation {
  isValid: boolean;
  score: number;
  violations: string[];
  suggestions: string[];
}

export interface CoverageAnalysis {
  inputSpaceCoverage: number;
  edgeCasesCovered: number;
  propertyTypes: string[];
  recommendations: string[];
}

export interface PropertyTestSuite {
  code: string;
  invariants: PropertyInvariant[];
  generators: GeneratorStrategy[];
  coverage: CoverageAnalysis;
}

export class PropertyTester extends Agent {
  getPromptTemplate(): string {
    return `Property-Based Testing Agent for invariant validation and edge case discovery. Generate comprehensive property tests with diverse input generators, mathematical/domain invariants, and shrinking strategies. Target: {{className}}, Methods: {{methods}}, Library: {{propertyLibrary}}.`;
  }

  async executeTask(): Promise<any> {
    if (!this.currentTask || !this.taskContext) {
      throw new Error('No task or context available');
    }

    const metadata = (this.currentTask as any).metadata || {};
    const { files, propertyLibrary = 'fast-check' } = this.taskContext;
    
    const sourceFiles = await this.readSourceFiles(files || []);
    const testSuite = await this.generatePropertyTestSuite(
      metadata?.targetClass || 'UnknownClass',
      sourceFiles,
      propertyLibrary
    );
    
    const testFilePath = this.generateTestFilePath(metadata?.targetClass || 'UnknownClass');
    await this.writeFile(testFilePath, testSuite.code);
    
    return {
      testSuite: testSuite.code,
      invariants: testSuite.invariants,
      generators: testSuite.generators,
      coverage: testSuite.coverage,
      message: 'Generated property-based tests with invariant validation and comprehensive input generation'
    };
  }

  async identifyInvariants(sourceCode: string): Promise<PropertyInvariant[]> {
    const methods = this.extractMethods(sourceCode);
    const invariants: PropertyInvariant[] = [];

    for (const method of methods) {
      if (this.isMathematicalOperation(method.name)) {
        invariants.push(...this.generateMathematicalInvariants(method));
      }
      invariants.push(...this.generateDomainInvariants(method));
      invariants.push(...this.generateGenericInvariants(method));
    }

    return invariants;
  }

  async selectGenerators(methodSignature: string): Promise<string[]> {
    const parameters = this.extractParameters(methodSignature);
    return parameters.map(param => this.selectGeneratorForType(param.type, param.name));
  }

  async generateEdgeCaseGenerators(methodSignature: string): Promise<string[]> {
    const parameters = this.extractParameters(methodSignature);
    const edgeCaseGenerators: string[] = [];
    for (const param of parameters) {
      edgeCaseGenerators.push(...this.getEdgeCasesForType(param.type, param.name));
    }
    return edgeCaseGenerators;
  }

  async generateRoundTripProperties(methods: string[]): Promise<string[]> {
    const properties: string[] = [];
    const encodeMethods = methods.filter(m => m.toLowerCase().includes('encode'));
    const decodeMethods = methods.filter(m => m.toLowerCase().includes('decode'));
    
    for (const encode of encodeMethods) {
      for (const decode of decodeMethods) {
        if (this.areRoundTripPair(encode, decode)) {
          properties.push(`${decode}(${encode}(data)) === data`);
        }
      }
    }

    const serializeMethods = methods.filter(m => m.toLowerCase().includes('serialize'));
    const deserializeMethods = methods.filter(m => m.toLowerCase().includes('deserialize'));
    
    for (const serialize of serializeMethods) {
      for (const deserialize of deserializeMethods) {
        if (this.areRoundTripPair(serialize, deserialize)) {
          properties.push(`${deserialize}(${serialize}(data)) deep equals data`);
        }
      }
    }

    return properties;
  }

  async generateMetamorphicProperties(methodInfo: any): Promise<string[]> {
    const { name, parameters, returnType } = methodInfo;
    const properties: string[] = [];

    if (returnType.includes('[]') && parameters.some((p: string) => p.includes('[]'))) {
      properties.push(`${name}(array).length === array.length`);
    }

    if (name.toLowerCase().includes('sort')) {
      properties.push(`${name}(${name}(array)) deep equals ${name}(array)`);
    }

    if (this.isCommutativeOperation(name)) {
      properties.push(`${name}(a, b) === ${name}(b, a)`);
    }

    if (this.isMonotonicOperation(name)) {
      properties.push(`a <= b implies ${name}(a) <= ${name}(b)`);
    }

    return properties;
  }

  async generateContractProperties(methodInfo: any): Promise<string[]> {
    const { preconditions = [], postconditions = [] } = methodInfo;
    const properties: string[] = [];

    if (preconditions.length > 0) {
      properties.push(preconditions.join(' && '));
    }

    for (const postcondition of postconditions) {
      properties.push(this.translatePostcondition(postcondition));
    }

    return properties;
  }

  async defineShrinkingStrategy(dataType: string, structure: any): Promise<string> {
    if (typeof structure === 'object' && structure !== null) {
      const fields = Object.entries(structure).map(([key, type]) => {
        const generator = this.selectGeneratorForType(type as string, key);
        return `${key}: ${generator}`;
      });

      return `fc.record({\n  ${fields.join(',\n  ')}\n})`;
    }

    return this.selectGeneratorForType(dataType, 'value');
  }

  async validateTestQuality(testCode: string): Promise<TestQualityValidation> {
    const violations: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    if (!testCode.includes('fc.assert') && !testCode.includes('fc.property')) {
      violations.push('Uses example-based testing instead of property-based');
      score -= 40;
    }

    if (!testCode.includes('fc.')) {
      violations.push('Missing fast-check generators');
      score -= 30;
    }

    const propertyCount = (testCode.match(/fc\.property/g) || []).length;
    if (propertyCount < 3) {
      violations.push('Insufficient property coverage');
      score -= 20;
    }

    if (!testCode.includes('constantFrom') && !testCode.includes('oneof')) {
      suggestions.push('Consider adding edge case generators');
      score -= 10;
    }

    if (!testCode.includes('fc.configureGlobal') && !testCode.includes('numRuns')) {
      suggestions.push('Consider configuring test runs and shrinking');
    }

    if (violations.length === 0) {
      suggestions.push('Excellent property-based test implementation');
    } else {
      suggestions.push('Add more property-based test patterns');
      suggestions.push('Include diverse input generators');
      suggestions.push('Validate mathematical/domain invariants');
    }

    return {
      isValid: violations.length === 0,
      score: Math.max(0, score),
      violations,
      suggestions
    };
  }

  async analyzeCoverage(generators: string[], testRuns: number): Promise<CoverageAnalysis> {
    return {
      inputSpaceCoverage: this.estimateInputSpaceCoverage(generators, testRuns),
      edgeCasesCovered: this.countEdgeCases(generators),
      propertyTypes: this.identifyPropertyTypes(generators),
      recommendations: this.generateCoverageRecommendations(generators, testRuns)
    };
  }

  private async readSourceFiles(files: string[]): Promise<string[]> {
    const sourceFiles: string[] = [];
    for (const file of files) {
      try {
        const content = await this.readFile(file);
        sourceFiles.push(content);
      } catch (error) {
        console.warn(`Could not read file ${file}: ${(error as Error).message}`);
      }
    }
    return sourceFiles;
  }

  private async generatePropertyTestSuite(className: string, sourceFiles: string[], propertyLibrary: string): Promise<PropertyTestSuite> {
    const sourceCode = sourceFiles.join('\n');
    const invariants = await this.identifyInvariants(sourceCode);
    
    const promptContext = {
      className,
      methods: this.extractMethods(sourceCode).map(m => m.name).join(', '),
      propertyLibrary,
      sourceFiles: sourceFiles.length.toString(),
      invariants: JSON.stringify(invariants, null, 2)
    };

    const prompt = this.formatPrompt(this.getPromptTemplate(), promptContext) + `

SOURCE CODE TO TEST:
${sourceCode}

IDENTIFIED INVARIANTS:
${JSON.stringify(invariants, null, 2)}

Generate a comprehensive property-based test suite that:
1. Tests all identified invariants with appropriate generators
2. Includes edge case generators for boundary conditions
3. Validates mathematical and domain-specific properties
4. Implements shrinking strategies for minimal failing cases
5. Provides good input space coverage

Use ${propertyLibrary} for property-based testing patterns.`;

    const response = await this.sendToClaude(prompt);
    
    const generators = this.extractGeneratorStrategies(response.content);
    const coverage = await this.analyzeCoverage(generators.map(g => g.generator), 1000);

    return { code: response.content, invariants, generators, coverage };
  }

  private extractMethods(sourceCode: string): any[] {
    const methods: any[] = [];
    const methodMatches = sourceCode.match(/(static\s+)?(\w+)\s*\([^)]*\)\s*:\s*[^{]+/g);
    if (methodMatches) {
      methodMatches.forEach(match => {
        const nameMatch = match.match(/(\w+)\s*\(/);
        if (nameMatch) {
          methods.push({
            name: nameMatch[1],
            signature: match.trim(),
            isStatic: match.includes('static')
          });
        }
      });
    }
    return methods;
  }

  private isMathematicalOperation(methodName: string): boolean {
    const mathOps = ['add', 'subtract', 'multiply', 'divide', 'sum', 'product', 'min', 'max'];
    return mathOps.some(op => methodName.toLowerCase().includes(op));
  }

  private generateMathematicalInvariants(method: any): PropertyInvariant[] {
    const invariants: PropertyInvariant[] = [];
    const methodName = method.name.toLowerCase();

    if (methodName.includes('add') || methodName.includes('sum')) {
      invariants.push(
        { name: 'commutativity', description: `${method.name}(a, b) === ${method.name}(b, a)`, applicableMethods: [method.name], generators: ['fc.integer()', 'fc.integer()'], complexity: 'simple' },
        { name: 'associativity', description: `${method.name}(${method.name}(a, b), c) === ${method.name}(a, ${method.name}(b, c))`, applicableMethods: [method.name], generators: ['fc.integer()', 'fc.integer()', 'fc.integer()'], complexity: 'moderate' },
        { name: 'identity', description: `${method.name}(n, 0) === n`, applicableMethods: [method.name], generators: ['fc.integer()'], complexity: 'simple' }
      );
    }

    if (methodName.includes('multiply')) {
      invariants.push({ name: 'distributivity', description: `multiply(a, add(b, c)) === add(multiply(a, b), multiply(a, c))`, applicableMethods: [method.name], generators: ['fc.integer()', 'fc.integer()', 'fc.integer()'], complexity: 'complex' });
    }

    return invariants;
  }

  private generateDomainInvariants(method: any): PropertyInvariant[] {
    const invariants: PropertyInvariant[] = [];
    const methodName = method.name.toLowerCase();

    if (methodName.includes('reverse')) {
      invariants.push({ name: 'reverse_involution', description: `reverse(reverse(s)) === s`, applicableMethods: [method.name], generators: ['fc.string()'], complexity: 'simple' });
    }

    if (methodName.includes('concat')) {
      invariants.push({ name: 'concat_length', description: `concat(a, b).length === a.length + b.length`, applicableMethods: [method.name], generators: ['fc.string()', 'fc.string()'], complexity: 'simple' });
    }

    return invariants;
  }

  private generateGenericInvariants(method: any): PropertyInvariant[] {
    return [{ name: 'null_safety', description: `${method.name} handles null/undefined inputs gracefully`, applicableMethods: [method.name], generators: ['fc.constantFrom(null, undefined)'], complexity: 'simple' }];
  }

  private extractParameters(methodSignature: string): any[] {
    const paramMatch = methodSignature.match(/\(([^)]*)\)/);
    if (!paramMatch) return [];

    const paramString = paramMatch[1];
    if (!paramString.trim()) return [];

    return paramString.split(',').map(param => {
      const parts = param.trim().split(':');
      return {
        name: parts[0].trim(),
        type: parts[1]?.trim() || 'any'
      };
    });
  }

  private selectGeneratorForType(type: string, paramName: string): string {
    const cleanType = type.replace(/\s+/g, '');
    
    switch (cleanType) {
      case 'number':
        if (paramName.toLowerCase().includes('rate') || paramName.toLowerCase().includes('percent')) {
          return 'fc.float({ min: 0, max: 1 })';
        }
        if (paramName.toLowerCase().includes('age')) {
          return 'fc.nat({ max: 120 })';
        }
        if (paramName.toLowerCase().includes('income') || paramName.toLowerCase().includes('amount')) {
          return 'fc.float({ min: 0, max: 1000000 })';
        }
        return 'fc.integer()';
      case 'string': return 'fc.string()';
      case 'boolean': return 'fc.boolean()';
      case 'number[]': return 'fc.array(fc.integer())';
      case 'string[]': return 'fc.array(fc.string())';
      default:
        if (cleanType.endsWith('[]')) {
          return `fc.array(fc.record({ /* ${cleanType.slice(0, -2)} properties */ }))`;
        }
        return `fc.record({ /* ${cleanType} properties */ })`;
    }
  }

  private getEdgeCasesForType(type: string, paramName: string): string[] {
    const edgeCases: string[] = [];
    
    switch (type) {
      case 'number':
        edgeCases.push('fc.constantFrom(0, -0, Infinity, -Infinity, NaN)');
        if (paramName.toLowerCase().includes('divisor')) {
          edgeCases.push('fc.constantFrom(0, -0)');
        }
        break;
      case 'string':
        edgeCases.push('fc.constantFrom("", " ", "\\n", "\\t")');
        break;
      case 'number[]':
      case 'string[]':
        edgeCases.push('fc.constantFrom([])');
        break;
    }
    
    return edgeCases;
  }

  private areRoundTripPair(method1: string, method2: string): boolean {
    const encode = method1.toLowerCase();
    const decode = method2.toLowerCase();
    
    return (encode.includes('encode') && decode.includes('decode')) ||
           (encode.includes('serialize') && decode.includes('deserialize')) ||
           (encode.includes('stringify') && decode.includes('parse'));
  }

  private isCommutativeOperation(name: string): boolean {
    const commutativeOps = ['add', 'multiply', 'max', 'min', 'gcd', 'lcm'];
    return commutativeOps.some(op => name.toLowerCase().includes(op));
  }

  private isMonotonicOperation(name: string): boolean {
    const monotonicOps = ['sqrt', 'log', 'abs', 'square'];
    return monotonicOps.some(op => name.toLowerCase().includes(op));
  }

  private translatePostcondition(postcondition: string): string {
    return postcondition.replace(/balance reduced by amount/, 'newBalance === oldBalance - amount');
  }

  private estimateInputSpaceCoverage(generators: string[], testRuns: number): number {
    const complexity = generators.length * 10;
    return Math.min(100, (testRuns / complexity) * 100);
  }

  private countEdgeCases(generators: string[]): number {
    return generators.filter(g => g.includes('constantFrom')).length;
  }

  private identifyPropertyTypes(generators: string[]): string[] {
    const types: string[] = [];
    if (generators.some(g => g.includes('integer'))) types.push('mathematical');
    if (generators.some(g => g.includes('string'))) types.push('string-based');
    if (generators.some(g => g.includes('array'))) types.push('collection-based');
    if (generators.some(g => g.includes('record'))) types.push('structural');
    return types;
  }

  private generateCoverageRecommendations(generators: string[], testRuns: number): string[] {
    const recommendations: string[] = [];
    if (testRuns < 1000) {
      recommendations.push('Consider increasing test runs for better coverage');
    }
    if (!generators.some(g => g.includes('constantFrom'))) {
      recommendations.push('Add edge case generators with constantFrom');
    }
    if (generators.length < 3) {
      recommendations.push('Consider adding more diverse generators');
    }
    return recommendations;
  }

  private extractGeneratorStrategies(testCode: string): GeneratorStrategy[] {
    const strategies: GeneratorStrategy[] = [];
    const generatorMatches = testCode.match(/fc\.\w+\([^)]*\)/g);
    if (generatorMatches) {
      generatorMatches.forEach((match, index) => {
        strategies.push({
          parameterName: `param${index}`,
          parameterType: 'unknown',
          generator: match,
          constraints: [],
          edgeCases: []
        });
      });
    }
    return strategies;
  }

  private generateTestFilePath(className: string): string {
    const testFileName = `${className.toLowerCase()}.property.test.ts`;
    return `tests/property/${testFileName}`;
  }
}