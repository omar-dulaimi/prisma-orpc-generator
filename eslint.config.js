const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  // Base configuration for all files
  js.configs.recommended,
  
  // TypeScript configuration (simplified for release)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        node: true,
        process: true,
        require: true,
        module: true,
        global: true,
        globalThis: true,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // Disable base ESLint unused vars rule in favor of TypeScript version
      'no-unused-vars': 'off',
      // Essential rules only for release
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'no-console': 'off', // Allow console for generator output
      'prefer-const': 'error',
      'no-var': 'error',
      'no-undef': 'off', // Let TypeScript handle this
    },
  },
  
  // Ignore patterns
  {
    ignores: [
      'lib/**',
      'dist/**',
      'coverage/**',
      'examples/**',
      'node_modules/**',
      'eslint.config.js',
      '.eslintrc.js',
      'test-workspaces/**',
      'debug-output/**',
      'temp-generated/**',
    ],
  },
];