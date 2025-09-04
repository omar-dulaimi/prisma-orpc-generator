import type { DMMF } from '@prisma/generator-helper';
import { EnvValue, GeneratorOptions } from '@prisma/generator-helper';
import { getDMMF, parseEnvValue } from '@prisma/internals';
import chalk from 'chalk';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { generate as PrismaZodGenerator } from 'prisma-zod-generator/lib/prisma-generator';

import { Config, configSchema } from '../config/schema';
import { PrismaModel } from '../types/generator-types';
import { Logger } from '../utils/logger';
import {
  convertDMMFModelsToPrismaModels,
  enhanceModelsWithMetadata,
  resolveModelsComments,
} from '../utils/model-utils';
import { ProjectManager } from '../utils/project-manager';
import { CodeGenerator } from './code-generator';
import { DocumentationGenerator } from './documentation-generator';
import { ShieldGenerator } from './shield-generator';
import { TestGenerator } from './test-generator';

// Minimal spinner to avoid ESM-only ora at runtime in CJS output
type SpinnerState = 'idle' | 'running' | 'stopped';
export interface SpinnerLike {
  start(_text?: string): void;
  stop(): void;
  succeed(_text?: string): void;
  fail(_text?: string): void;
  text: string;
}

function createSpinner(enabled: boolean = false): SpinnerLike {
  // Spinner output is DISABLED by default.
  // Enable with any of:
  // - ORPC_SPINNER=true
  // - ORPC_DEBUG / DEBUG contains 'orpc'
  // - ORPC_LOG_LEVEL / ORPC_LOG in {info, debug, warn, 1, true}
  // - enableDebugLogging generator config (passed via 'enabled')
  const rawLevel = (process.env.ORPC_LOG_LEVEL || process.env.ORPC_LOG || '')
    .toString()
    .toLowerCase();
  const dbg = (process.env.ORPC_DEBUG || process.env.DEBUG || '').toString().toLowerCase();
  const spinnerEnv = (process.env.ORPC_SPINNER || '').toString().toLowerCase();

  const explicitlyDisable =
    spinnerEnv === 'false' ||
    rawLevel === 'silent' ||
    rawLevel === 'none' ||
    rawLevel === '0' ||
    rawLevel === 'off';

  const explicitlyEnable =
    spinnerEnv === 'true' ||
    dbg.includes('orpc') ||
    rawLevel === 'info' ||
    rawLevel === 'debug' ||
    rawLevel === 'warn' ||
    rawLevel === '1' ||
    rawLevel === 'true';

  const canLog = explicitlyDisable ? false : enabled || explicitlyEnable;

  let text = '';
  let state: SpinnerState = 'idle';
  const log = (prefix: string, t?: string) => {
    if (!canLog) return;
    const msg = t ?? text;
    if (msg) {
      // Keep logs concise; avoid overwriting lines in non-TTY
      console.log(`${prefix} ${msg}`);
    }
  };
  return {
    get text() {
      return text;
    },
    set text(v: string) {
      text = v;
      if (state === 'running') log('⏳');
    },
    start(t?: string) {
      state = 'running';
      if (t) text = t;
      log('⏳', t);
    },
    stop() {
      state = 'stopped';
    },
    succeed(t?: string) {
      state = 'stopped';
      log('✅', t);
    },
    fail(t?: string) {
      state = 'stopped';
      log('❌', t);
    },
  };
}

export class ORPCGenerator {
  private config: Config;
  private outputDir: string;
  private projectManager: ProjectManager;
  private logger: Logger;
  private spinner: SpinnerLike;
  private plugins: ORPCGeneratorPlugin[] = [];

  constructor(private options: GeneratorOptions) {
    const results = configSchema.safeParse(options.generator.config);
    if (!results.success) {
      throw new Error(`Invalid generator configuration: ${results.error.message}`);
    }

    this.config = results.data;
    this.outputDir = parseEnvValue(options.generator.output as EnvValue);
    this.projectManager = new ProjectManager(this.outputDir);
    this.logger = new Logger(this.config.enableDebugLogging);
    this.spinner = createSpinner(this.config.enableDebugLogging);
  }

  /**
   * Normalize config flags that may arrive as strings ("true"/"false") from external generator config.
   */
  private isEnabled(value: unknown): boolean {
    return value === true || value === 'true';
  }

  async generate(): Promise<void> {
    try {
      this.startGeneration();
      await this.loadPlugins();

      // Phase 1: Setup and validation
      await this.setupOutputDirectory();
      await this.validatePrismaClient();

      // Phase 2: Schema analysis
      const dmmf = await this.analyzePrismaSchema();
      const models = this.processModels(dmmf);

      // Phase 3: Core generation
      await this.generateCoreFiles(models, dmmf);

      // Phase 4: Advanced features
      await this.generateAdvancedFeatures(this.options, models);

      // Phase 5: Optimization and finalization
      await this.optimizeOutput();
      await this.finalizeGeneration();
      await this.runPostWriteHooks();

      this.completeGeneration();
    } catch (error) {
      this.handleGenerationError(error);
      throw error;
    }
  }

  private startGeneration(): void {
    this.spinner.start(chalk.blue('🚀 Generating oRPC routers...'));
    this.logger.info('Starting oRPC generation with configuration:', this.config);
  }

  private async setupOutputDirectory(): Promise<void> {
    this.spinner.text = 'Setting up output directory...';

    await fs.mkdir(this.outputDir, { recursive: true });

    // Clean existing generated files
    await this.projectManager.cleanOutputDirectory();

    // Create minimal directory structure; optional features will create their own folders when enabled
    const baseDirs = ['routers', 'routers/models', 'routers/helpers'];

    await this.projectManager.createDirectoryStructure(baseDirs);

    this.logger.debug('Output directory structure created');

    // Schema drift advisory hash compare
    try {
      const datamodel = this.options.datamodel || '';
      const currentHash = crypto.createHash('sha256').update(datamodel).digest('hex');
      const hashFile = path.join(this.outputDir, '.schema-hash');
      let previousHash: string | null = null;
      try {
        previousHash = await fs.readFile(hashFile, 'utf8');
      } catch {
        // ignore - first run
      }
      if (previousHash && previousHash !== currentHash) {
        this.logger.info(
          '⚠️  Schema drift advisory: detected Prisma schema change since last generation.'
        );
      }
      await fs.writeFile(hashFile, currentHash, 'utf8');
    } catch (e) {
      this.logger.debug('Schema drift advisory skipped:', e);
    }
  }

  private async validatePrismaClient(): Promise<void> {
    this.spinner.text = 'Validating Prisma Client configuration...';

    const prismaClientProvider = this.options.otherGenerators.find((generator) => {
      const provider = parseEnvValue(generator.provider);
      return provider === 'prisma-client-js' || provider === 'prisma-client';
    });

    if (!prismaClientProvider) {
      throw new Error(
        'oRPC Generator requires a Prisma Client generator. Please add the following to your schema:\n\n' +
          'generator client {\n' +
          '  provider = "prisma-client-js"\n' +
          '}'
      );
    }

    this.logger.debug('Prisma Client validation completed');
  }

  private async analyzePrismaSchema(): Promise<DMMF.Document> {
    this.spinner.text = 'Analyzing Prisma schema...';

    const prismaClientProvider = this.options.otherGenerators.find((generator) => {
      const provider = parseEnvValue(generator.provider);
      return provider === 'prisma-client-js' || provider === 'prisma-client';
    });

    const dmmf = await getDMMF({
      datamodel: this.options.datamodel,
      previewFeatures: prismaClientProvider?.previewFeatures || [],
    });

    this.logger.debug(`Analyzed ${dmmf.datamodel.models.length} models from Prisma schema`);
    return dmmf;
  }

  private processModels(dmmf: DMMF.Document): PrismaModel[] {
    this.spinner.text = 'Processing Prisma models...';

    const models = [...dmmf.datamodel.models];
    const hiddenModels: string[] = [];

    // Resolve model comments and metadata
    resolveModelsComments(models, hiddenModels);
    const enhancedModels = enhanceModelsWithMetadata(models, this.config);

    // Filter visible models
    const visibleModels = enhancedModels.filter((model) => !hiddenModels.includes(model.name));

    // Convert DMMF models to PrismaModel format
    const convertedModels = convertDMMFModelsToPrismaModels(visibleModels);

    this.logger.debug(
      `Processed ${convertedModels.length} visible models (${hiddenModels.length} hidden)`
    );
    return convertedModels;
  }

  private async generateCoreFiles(models: PrismaModel[], dmmf: DMMF.Document): Promise<void> {
    this.spinner.text = 'Generating core oRPC files...';

    const codeGenerator = new CodeGenerator(
      this.config,
      this.outputDir,
      this.projectManager,
      this.logger
    );

    // Generate base router and utilities
    await codeGenerator.generateBaseRouter(this.options);

    // Generate model routers
    for (const model of models) {
      await this.runPreModelHooks(model, dmmf);
      await codeGenerator.generateModelRouter(model, [...dmmf.mappings.modelOperations]);
    }

    // Generate main app router
    await codeGenerator.generateAppRouter(models);

    // Generate shield rules if enabled
    if (this.isEnabled(this.config.generateShield)) {
      const shieldGenerator = new ShieldGenerator(
        this.config,
        this.outputDir,
        this.projectManager,
        this.logger
      );
      await shieldGenerator.generateShield(models);
    }

    this.logger.debug('Core files generation completed');
  }

  private async generateAdvancedFeatures(
    options: GeneratorOptions,
    models: PrismaModel[]
  ): Promise<void> {
    const tasks = [];

    // Ensure prisma-zod-generator outputs are available when using Zod
    if (this.config.schemaLibrary === 'zod') {
      this.spinner.text = 'Generating Zod schemas (prisma-zod-generator)...';
      tasks.push(this.generateZodSchemasProgrammatically(options, models));
    }

    // Documentation
    if (this.isEnabled(this.config.generateDocumentation)) {
      this.spinner.text = 'Generating documentation...';
      tasks.push(this.generateDocumentation(models));
    }

    // Tests
    if (this.isEnabled(this.config.generateTests)) {
      this.spinner.text = 'Generating tests...';
      tasks.push(this.generateTests(models));
    }

    // Run tasks in parallel for performance
    await Promise.all(tasks);

    this.logger.debug('Advanced features generation completed');
  }

  private async generateDocumentation(models: PrismaModel[]): Promise<void> {
    const docGenerator = new DocumentationGenerator(this.config, this.outputDir, this.logger);
    await docGenerator.generateDocumentation(models as any);
  }

  private async generateTests(models: PrismaModel[]): Promise<void> {
    const testGenerator = new TestGenerator(
      this.config,
      this.outputDir,
      this.projectManager,
      this.logger
    );
    await testGenerator.generateTests(models);
  }

  private async generateZodSchemasProgrammatically(
    options: GeneratorOptions,
    _models?: PrismaModel[]
  ): Promise<void> {
    try {
      const rawOutput = parseEnvValue(options.generator.output as EnvValue);
      // Base resolution: like Prisma would (relative to schema file)
      const outputDir = path.isAbsolute(rawOutput)
        ? rawOutput
        : path.resolve(path.dirname(options.schemaPath), rawOutput);

      // Call prisma-zod-generator directly, redirecting output to our schemas folder
      const zodOutput = path.relative(
        path.dirname(options.schemaPath),
        path.join(outputDir, 'zod-schemas')
      );

      // Create zod.config.json dynamically with relative paths
      const zodConfigPath = await this.createZodConfig(options, zodOutput);

      // Ensure datasources is provided for prisma-zod-generator
      const generatorOptions: GeneratorOptions = {
        ...options,
        generator: {
          ...options.generator,
          config: {
            ...options.generator.config,
            config: zodConfigPath,
          },
        },
        // Provide default datasources if missing
        datasources: options.datasources || [
          {
            name: 'db',
            provider: 'sqlite',
            url: { value: 'file:./dev.db', fromEnvVar: null },
            directUrl: null,
          },
        ],
      };

      await PrismaZodGenerator(generatorOptions);

      this.logger.debug(`Generated Zod schemas using prisma-zod-generator to ${zodOutput}`);
      this.logger.debug(`Zod configuration saved to ${zodConfigPath} for customization`);
    } catch (error) {
      this.logger.error(`Failed to generate Zod schemas: ${error}`);
      // Log the error but continue - schemas are optional
      this.logger.warn('Continuing without Zod schemas - validation will be disabled');
    }
  }

  private async createZodConfig(options: GeneratorOptions, zodOutput: string): Promise<string> {
    // Check if user provided a custom config path
    if (this.config.zodConfigPath) {
      const customConfigPath = path.isAbsolute(this.config.zodConfigPath)
        ? this.config.zodConfigPath
        : path.resolve(path.dirname(options.schemaPath), this.config.zodConfigPath);

      try {
        await fs.access(customConfigPath);
        this.logger.debug(`Using custom Zod configuration from ${customConfigPath}`);
        return customConfigPath;
      } catch {
        throw new Error(`Custom Zod config file not found: ${customConfigPath}`);
      }
    }

    // Default config path alongside schema
    const defaultConfigPath = path.join(path.dirname(options.schemaPath), 'zod.config.json');

    // Check if default config already exists
    try {
      await fs.access(defaultConfigPath);
      this.logger.debug(`Using existing Zod configuration from ${defaultConfigPath}`);

      // Don't modify existing config file - settings are passed as generator options instead

      return defaultConfigPath;
    } catch {
      // Config doesn't exist, create it with pure Zod configuration
    }

    // Start with minimal config
    const minimalZodConfig = {
      mode: 'full',
      output: zodOutput,
    };

    // Add oRPC-managed settings only if they differ from defaults or are explicitly set
    const zodConfigWithORPCSettings = {
      ...minimalZodConfig,
      // Only add dateTimeStrategy if it's not the default
      ...(this.config.zodDateTimeStrategy !== 'coerce'
        ? { dateTimeStrategy: this.config.zodDateTimeStrategy }
        : {}),
    };

    // Use minimal config if no oRPC overrides, otherwise use the merged config
    const finalZodConfig =
      this.config.zodDateTimeStrategy !== 'coerce' ? zodConfigWithORPCSettings : minimalZodConfig;

    await fs.writeFile(defaultConfigPath, JSON.stringify(finalZodConfig, null, 2), 'utf8');
    this.logger.debug(
      `Created ${finalZodConfig === minimalZodConfig ? 'minimal' : 'customized'} Zod configuration at ${defaultConfigPath}`
    );

    return defaultConfigPath;
  }

  private async optimizeOutput(): Promise<void> {
    // Format generated code
    if (this.config.codeStyle === 'prettier') {
      this.spinner.text = 'Formatting generated code...';
      await this.projectManager.formatCode();
    }
  }

  private async finalizeGeneration(): Promise<void> {
    this.spinner.text = 'Finalizing generation...';

    // Save all generated files
    await this.projectManager.saveProject();

    // Generate barrel exports if enabled
    if (this.config.useBarrelExports) {
      await this.projectManager.generateBarrelExports();
    }

    // Create package.json for generated code if needed
    await this.projectManager.generatePackageInfo(this.config);

    this.logger.debug('Generation finalization completed');

    // Export effective resolved config JSON
    try {
      const effectivePath = path.join(this.outputDir, 'config-effective.json');
      await fs.writeFile(effectivePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      this.logger.error('Failed to write config-effective.json', e);
    }
  }

  private completeGeneration(): void {
    this.spinner.succeed(chalk.green('✅ oRPC routers generated successfully!'));

    // Display generation summary
    this.displayGenerationSummary();
  }

  private handleGenerationError(error: Error | unknown): void {
    this.spinner.fail(chalk.red('❌ Generation failed'));
    this.logger.error('Generation error:', error);
  }

  private displayGenerationSummary(): void {
    // Respect logger level for summary output
    this.logger.info(chalk.cyan('\n📊 Generation Summary:'));
    this.logger.info(chalk.gray('─'.repeat(50)));

    const features: string[] = [];
    if (this.isEnabled(this.config.generateTests)) features.push('Test Generation');

    this.logger.info(chalk.white(`📁 Output Directory: ${this.outputDir}`));
    this.logger.info(chalk.white(`🛠️  Schema Library: ${this.config.schemaLibrary}`));
    this.logger.info(chalk.white(`✨ Generated Features: ${features.join(', ')}`));

    const stats = this.projectManager.getGenerationStats();
    if (stats.skippedWrites !== undefined) {
      this.logger.info(chalk.white(`🧩 Skipped Writes (incremental): ${stats.skippedWrites}`));
    }

    this.logger.info(chalk.gray('─'.repeat(50)));
    this.logger.info(chalk.green('🚀 Your oRPC API is ready to use!\n'));
  }

  // Plugin system methods (basic implementation)
  private async loadPlugins(): Promise<void> {
    // Plugin loading disabled (experimental plugin system removed)
    return;
  }

  private async runPreModelHooks(model: PrismaModel, dmmf: DMMF.Document): Promise<void> {
    for (const p of this.plugins) {
      if (p.preModelHook) {
        try {
          await p.preModelHook(model, {
            dmmf,
            config: this.config,
            logger: this.logger,
          });
        } catch (e) {
          this.logger.error(`preModelHook failed (${p.name})`, e);
        }
      }
    }
  }

  private async runPostWriteHooks(): Promise<void> {
    for (const p of this.plugins) {
      if (p.postWriteHook) {
        try {
          await p.postWriteHook({
            outputDir: this.outputDir,
            config: this.config,
            logger: this.logger,
            project: this.projectManager,
          });
        } catch (e) {
          this.logger.error(`postWriteHook failed (${p.name})`, e);
        }
      }
    }
  }
}

// Plugin System Interfaces
export interface ORPCGeneratorPlugin {
  name: string;
  preModelHook?(
    model: PrismaModel,
    ctx: { dmmf: DMMF.Document; config: Config; logger: Logger }
  ): Promise<void> | void;
  postWriteHook?(ctx: {
    outputDir: string;
    config: Config;
    logger: Logger;
    project: ProjectManager;
  }): Promise<void> | void;
}

export type PluginModule = { default?: ORPCGeneratorPlugin } | ORPCGeneratorPlugin;

// Main generator function for Prisma
export async function generate(options: GeneratorOptions): Promise<void> {
  const generator = new ORPCGenerator(options);
  await generator.generate();
}
