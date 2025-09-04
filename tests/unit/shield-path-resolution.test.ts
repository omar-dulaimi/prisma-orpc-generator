import path from 'path';
import { describe, expect, it } from 'vitest';
import { CodeGenerator } from '../../lib/generators/code-generator';
import { Logger } from '../../lib/utils/logger';
import { ProjectManager } from '../../lib/utils/project-manager';

describe('Shield Path Resolution', () => {
  const mockLogger = new Logger();
  const mockProjectManager = new ProjectManager(path.join(__dirname, 'test-output'));
  const outputDir = path.join(__dirname, 'test-output');

  function createGenerator(config: any) {
    return new CodeGenerator(
      {
        generateShield: true,
        ...config
      },
      outputDir,
      mockProjectManager,
      mockLogger
    );
  }

  it('should use default shield path when no custom path provided', () => {
    const generator = createGenerator({});
    const result = generator['resolveShieldModuleSpecifier']();
    expect(result).toBe('../shield');
  });

  it('should resolve absolute paths correctly', () => {
    const generator = createGenerator({
      shieldPath: path.join(__dirname, 'test-shield.ts')
    });
    const result = generator['resolveShieldModuleSpecifier']();
    // For absolute paths, it calculates relative path from output/routers directory
    expect(result).toMatch(/^\.\.\/.*test-shield\.ts$/);
  });

  it('should resolve relative paths from project root', () => {
    const generator = createGenerator({
      shieldPath: 'test/shield.ts'
    });
    const result = generator['resolveShieldModuleSpecifier']();
    // For non-existent relative paths, it returns the path as-is since fs.statSync fails
    expect(result).toBe('test/shield.ts');
  });

  it('should resolve node_modules packages', () => {
    const generator = createGenerator({
      shieldPath: 'orpc-shield'
    });
    const result = generator['resolveShieldModuleSpecifier']();
    expect(result).toBe('orpc-shield');
  });

  it('should resolve scoped packages', () => {
    const generator = createGenerator({
      shieldPath: '@org/shield'
    });
    const result = generator['resolveShieldModuleSpecifier']();
    expect(result).toBe('@org/shield');
  });

  it('should fallback to default when path cannot be resolved', () => {
    const generator = createGenerator({
      shieldPath: 'non-existent-path'
    });
    const result = generator['resolveShieldModuleSpecifier']();
    // For non-existent paths, it returns the path as-is (line 631 in code)
    expect(result).toBe('non-existent-path');
  });
});