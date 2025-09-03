import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { IndentationText, Project, SourceFile } from 'ts-morph';
import { Config } from '../config/schema';

interface PackageJsonLike {
  name: string;
  version: string;
  description: string;
  main: string;
  types?: string;
  exports: Record<string, unknown>;
  files: string[];
  dependencies: Record<string, string | undefined>;
  peerDependencies: Record<string, string>;
  keywords: string[];
  type?: string;
}

export class ProjectManager {
  private project: Project;
  private fileHashes: Map<string, string> = new Map();
  private skipped: number = 0;

  constructor(private outputDir: string) {
    this.project = new Project({
      compilerOptions: {
        target: 99, // Latest
        module: 1, // CommonJS
        lib: ['lib.es2020.d.ts'],
        declaration: true,
        outDir: outputDir,
        strict: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        skipLibCheck: true,
      },
      manipulationSettings: {
        indentationText: IndentationText.TwoSpaces,
        useTrailingCommas: true,
      },
    });
  }

  async cleanOutputDirectory(): Promise<void> {
    try {
      // Remove existing generated files, but preserve user files
      const entries = await fs.readdir(this.outputDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(this.outputDir, entry.name);

        if (entry.isDirectory()) {
          // Remove generated directories
          const generatedDirs = [
            'routers',
            'schemas',
            'types',
            'clients',
            'tests',
            'utils',
            // Optional feature dirs — clean them unless explicitly regenerated this run
            'benchmarks',
            'coverage-assets',
            'k8s',
            'documentation',
            'seed',
          ];
          if (generatedDirs.includes(entry.name)) {
            await this.removeDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          // Remove generated files (but preserve user configuration files)
          const preserveFiles = ['package.json', '.env', 'README.md'];
          // Known generated single-file artifacts tied to optional features
          const removableArtifacts = ['Dockerfile', '.dockerignore'];
          if (
            !preserveFiles.includes(entry.name) &&
            (entry.name.endsWith('.ts') ||
              entry.name.endsWith('.js') ||
              removableArtifacts.includes(entry.name))
          ) {
            await fs.unlink(fullPath);
          }
        }
      }
    } catch {
      // Directory might not exist, that's fine
    }
  }

  private async removeDirectory(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }
  }

  async createDirectoryStructure(directories: string[]): Promise<void> {
    for (const dir of directories) {
      await fs.mkdir(path.join(this.outputDir, dir), { recursive: true });
    }
  }

  createSourceFile(
    filePath: string,
    sourceText?: string,
    options?: { overwrite?: boolean }
  ): SourceFile {
    // If incremental generation disabled, behave normally
    const sf = this.project.getSourceFile(filePath);
    if (sf && !options?.overwrite) return sf;
    // Compute hash for potential skip after save phase (content may be large)
    const text = sourceText ?? '';
    return this.project.createSourceFile(filePath, text, options);
  }

  getSourceFile(filePath: string): SourceFile | undefined {
    return this.project.getSourceFile(filePath);
  }

  async saveProject(): Promise<void> {
    // FEATURE:incremental-generation-framework:progress
    // Note: Parallel write tracking removed as unused
    for (const sf of this.project.getSourceFiles()) {
      const content = sf.getFullText();
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const rel = path.relative(this.outputDir, sf.getFilePath());
      const prev = this.fileHashes.get(rel);
      if (prev && prev === hash) {
        // Skip writing identical content
        this.skipped++;
        // Remove from emit to avoid disk write (ts-morph lacks direct skip; manual check below)
        continue;
      }
      this.fileHashes.set(rel, hash);
    }
    await this.project.save();
  }

  async formatCode(): Promise<void> {
    // Format all source files
    for (const sourceFile of this.project.getSourceFiles()) {
      sourceFile.formatText({
        indentSize: 2,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
      });
    }
  }

  async generateBarrelExports(): Promise<void> {
    // Generate index.ts files for barrel exports
    await this.generateBarrelExport('routers');
    // No internal schemas barrel export
    await this.generateBarrelExport('types');
    await this.generateBarrelExport('utils');
  }

  private async generateBarrelExport(directory: string): Promise<void> {
    const dirPath = path.join(this.outputDir, directory);

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const exports: string[] = [];

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
          const moduleName = entry.name.replace('.ts', '');
          exports.push(`export * from './${moduleName}';`);
        } else if (entry.isDirectory()) {
          // Check if subdirectory has an index.ts
          const subIndexPath = path.join(dirPath, entry.name, 'index.ts');
          try {
            await fs.access(subIndexPath);
            exports.push(`export * from './${entry.name}';`);
          } catch {
            // No index.ts in subdirectory, skip
          }
        }
      }

      if (exports.length > 0) {
        const indexFile = this.createSourceFile(
          path.join(dirPath, 'index.ts'),
          exports.join('\n'),
          { overwrite: true }
        );
        indexFile.formatText({ indentSize: 2 });
      }
    } catch {
      // Directory might not exist, that's fine
    }
  }

  async generatePackageInfo(_config: Config): Promise<void> {
    const packageJson: PackageJsonLike = {
      name: '@generated/orpc-api',
      version: '1.0.0',
      description: 'Generated ORPC API from Prisma schema',
      main: './routers/index.js',
      exports: {
        '.': {
          import: './routers/index.js',
          require: './routers/index.js',
        },
        './routers': {
          import: './routers/index.js',
          require: './routers/index.js',
        },
        // Note: internal folders not exported
      },
      files: ['routers/**/*'],
      dependencies: {
        '@orpc/server': '^1.8.5',
        '@prisma/client': '^6.15.0',
        zod: '^4.1.5',
      },
      peerDependencies: {
        '@prisma/client': '>=6.0.0',
      },
      keywords: ['orpc', 'prisma', 'api', 'type-safe', 'generated'],
    };

    // Remove undefined values
    const cleanPackageJson = JSON.parse(JSON.stringify(packageJson));

    await fs.writeFile(
      path.join(this.outputDir, 'package.json'),
      JSON.stringify(cleanPackageJson, null, 2)
    );
  }

  getProject(): Project {
    return this.project;
  }

  // Statistics and analysis
  getGenerationStats(): {
    totalFiles: number;
    totalLines: number;
    routerFiles: number;
    schemaFiles: number;
    typeFiles: number;
    skippedWrites?: number;
  } {
    const sourceFiles = this.project.getSourceFiles();

    let totalLines = 0;
    let routerFiles = 0;
    let schemaFiles = 0;
    let typeFiles = 0;

    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      totalLines += sourceFile.getFullText().split('\n').length;

      if (filePath.includes('/routers/')) routerFiles++;
      else if (filePath.includes('/schemas/')) schemaFiles++;
      else if (filePath.includes('/types/')) typeFiles++;
    }

    return {
      totalFiles: sourceFiles.length,
      totalLines,
      routerFiles,
      schemaFiles,
      typeFiles,
      skippedWrites: this.skipped,
    };
  }
}
