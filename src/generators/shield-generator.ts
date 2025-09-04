import path from 'path';
import { SourceFile } from 'ts-morph';

import { Config } from '../config/schema';
import { PrismaModel } from '../types/generator-types';
import { Logger } from '../utils/logger';
import { ProjectManager } from '../utils/project-manager';

export class ShieldGenerator {
  constructor(
    private config: Config,
    private outputDir: string,
    private projectManager: ProjectManager,
    private logger: Logger
  ) {}

  async generateShield(models: PrismaModel[]): Promise<void> {
    if (!this.config.generateShield) {
      this.logger.debug('Shield generation disabled, skipping...');
      return;
    }

    // If user provided a custom shield path, skip auto-generation
    if (this.config.shieldPath) {
      this.logger.debug(`Using custom shield from: ${this.config.shieldPath}`);
      return;
    }

    try {
      this.logger.debug('Generating oRPC Shield rules...');

      const shieldFile = this.projectManager.createSourceFile(
        path.resolve(this.outputDir, 'shield.ts'),
        undefined,
        { overwrite: true }
      );

      await this.generateShieldContent(shieldFile, models);

      shieldFile.formatText({ indentSize: 2 });
      this.logger.debug('Shield rules generated successfully');
    } catch (error) {
      this.logger.error(`Failed to generate shield file: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  private async generateShieldContent(
    sourceFile: SourceFile,
    models: PrismaModel[]
  ): Promise<void> {
    // Add imports
    sourceFile.addImportDeclaration({
      moduleSpecifier: 'orpc-shield',
      namedImports: ['rule', 'allow', 'deny', 'shield'],
    });

    sourceFile.addImportDeclaration({
      moduleSpecifier: './routers/helpers/createRouter',
      isTypeOnly: true,
      namedImports: ['Context'],
    });

    // Generate built-in rules
    const builtInRules = this.generateBuiltInRules();
    sourceFile.addStatements(builtInRules);

    // Generate model-specific rules
    const modelRules = this.generateModelRules(models);
    sourceFile.addStatements(modelRules);

    // Generate the shield configuration
    const shieldConfig = this.generateShieldConfig(models);
    sourceFile.addStatements(shieldConfig);
  }

  private generateBuiltInRules(): string {
    const rules: string[] = [];

    // Only include basic authentication rule - no assumptions about user data structure
    rules.push(`/**
 * Rule that requires user authentication
 * This is the only built-in rule - customize others based on your app's needs
 */
const isAuthenticated = rule<Context>()(({ ctx }) => !!ctx.user);`);

    return rules.join('\n\n');
  }

  private generateModelRules(models: PrismaModel[]): string {
    const rules: string[] = [];

    for (const model of models) {
      const modelRules = this.generateRulesForModel(model);
      if (modelRules) {
        rules.push(modelRules);
      }
    }

    return rules.join('\n\n');
  }

  private generateRulesForModel(model: PrismaModel): string {
    const rules: string[] = [];

    // Read operations rule - explicit handling with secure default
    if (this.config.defaultReadRule === 'auth') {
      rules.push(`const canRead${model.name} = isAuthenticated;`);
    } else if (this.config.defaultReadRule === 'deny') {
      rules.push(`const canRead${model.name} = deny;`);
    } else if (this.config.defaultReadRule === 'allow') {
      rules.push(`const canRead${model.name} = allow;`);
    } else {
      // Secure default for unrecognized values
      rules.push(`const canRead${model.name} = deny;`);
    }

    // Write operations rule - explicit handling with secure default
    if (this.config.defaultWriteRule === 'auth') {
      rules.push(`const canWrite${model.name} = isAuthenticated;`);
    } else if (this.config.defaultWriteRule === 'deny') {
      rules.push(`const canWrite${model.name} = deny;`);
    } else if (this.config.defaultWriteRule === 'allow') {
      rules.push(`const canWrite${model.name} = allow;`);
    } else {
      // Secure default for unrecognized values
      rules.push(`const canWrite${model.name} = deny;`);
    }

    return rules.length > 0 ? `// Rules for ${model.name} model\n${rules.join('\n')}` : '';
  }

  private generateShieldConfig(models: PrismaModel[]): string {
    const shieldRules: string[] = [];

    for (const model of models) {
      const modelShield = this.generateModelShieldConfig(model);
      if (modelShield) {
        shieldRules.push(modelShield);
      }
    }

    const shieldOptions = this.generateShieldOptions();

    return `
/**
 * Main shield configuration with rules for all models
 * Generated based on Prisma schema and configuration
 */
export const permissions = shield<Context>({
${shieldRules.join(',\n')}
}${shieldOptions});

/**
 * Type definition for the shield permissions
 */
export type Permissions = typeof permissions;
`;
  }

  private toLowerCamelCase(name: string): string {
    return name ? name.charAt(0).toLowerCase() + name.slice(1) : name;
  }

  private generateModelShieldConfig(model: PrismaModel): string {
    const modelName = this.toLowerCamelCase(model.name);
    const operations: string[] = [];

    // Map Prisma operations to shield rules
    const operationMappings: Record<string, string> = {
      findMany: 'list',
      findUnique: 'findById',
      findFirst: 'findFirst',
      create: 'create',
      createMany: 'createMany',
      update: 'update',
      updateMany: 'updateMany',
      upsert: 'upsert',
      delete: 'delete',
      deleteMany: 'deleteMany',
      count: 'count',
      aggregate: 'aggregate',
      groupBy: 'groupBy',
    };

    // Generate rules for each operation
    for (const [prismaOp, shieldOp] of Object.entries(operationMappings)) {
      if (this.isWriteOperation(prismaOp)) {
        operations.push(`    ${shieldOp}: canWrite${model.name}`);
      } else {
        operations.push(`    ${shieldOp}: canRead${model.name}`);
      }
    }

    return `  ${modelName}: {
${operations.join(',\n')}
  }`;
  }

  private isWriteOperation(operation: string): boolean {
    const writeOps = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];
    return writeOps.includes(operation);
  }

  private generateShieldOptions(): string {
    const options: string[] = [];

    if (this.config.denyErrorCode !== 'FORBIDDEN') {
      options.push(`denyErrorCode: '${this.config.denyErrorCode}'`);
    }

    if (this.config.debug) {
      options.push('debug: true');
    }

    if (this.config.allowExternalErrors) {
      options.push('allowExternalErrors: true');
    }

    return options.length > 0 ? `, {\n  ${options.join(',\n  ')}\n}` : '';
  }
}