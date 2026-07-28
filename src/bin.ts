#!/usr/bin/env node

import { generatorHandler } from '@prisma/generator-helper';
import { generate } from './generators/orpc-generator';
import { displayInfo, checkCompatibility } from './index';

// Show generator info
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  displayInfo();
  process.exit(0);
}

if (process.argv.includes('--check')) {
  const compatibility = checkCompatibility();
  
  if (compatibility.compatible) {
    console.log('✅ Environment is compatible');
  } else {
    console.log('❌ Compatibility issues found:');
    compatibility.issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  if (compatibility.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    compatibility.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
  
  process.exit(compatibility.compatible ? 0 : 1);
}

// Main generator handler
generatorHandler({
  onManifest() {
    return {
      version: '0.0.1',
      defaultOutput: './src/generated/orpc',
      prettyName: 'Prisma oRPC Generator',
      // No `requiresGenerators`. Prisma matches that list against the literal
      // `provider`, with no aliasing between `prisma-client-js` and the
      // `prisma-client` provider that is the default on Prisma 7. Declaring
      // `['prisma-client-js']` therefore hard-failed `prisma generate` for
      // everyone on the current path, which this package requires: it declares
      // a peer of `@prisma/client >=7.0.0` and then refused to run alongside
      // Prisma 7's own client generator. Because the check is an AND it cannot
      // express "either provider" either. The presence check now happens in
      // `generate`, where it can accept both and warn instead of aborting.
    };
  },
  onGenerate: generate,
});