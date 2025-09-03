import { Config } from '../config/schema';

interface ValidationRequirement {
  requiresInput: boolean;
  requiresOutput: boolean;
  inputOptional: boolean;
}

/**
 * Get input type name for a given operation
 */
export function getInputTypeByOpName(opType: string, modelName: string): string | undefined {
  const inputTypeMap: Record<string, string> = {
    create: `${modelName}CreateInput`,
    createMany: `${modelName}CreateInput`,
    findFirst: `${modelName}WhereInput`,
    findMany: `${modelName}WhereInput`,
    findUnique: `${modelName}WhereUniqueInput`,
    update: `${modelName}UpdateArgs`,
    updateMany: `${modelName}UpdateManyArgs`,
    upsert: `${modelName}UpsertArgs`,
    delete: `${modelName}WhereUniqueInput`,
    deleteMany: `${modelName}WhereInput`,
    count: `${modelName}WhereInput`,
    aggregate: `${modelName}WhereInput`,
    groupBy: `${modelName}WhereInput`,
  };

  return inputTypeMap[opType];
}

/**
 * Get output type name for a given operation
 */
export function getOutputTypeByOpName(opType: string, modelName: string): string | undefined {
  const outputTypeMap: Record<string, string | undefined> = {
    create: modelName,
    createMany: `${modelName}CountOutput`,
    findFirst: `${modelName}`,
    findMany: `${modelName}Array`,
    findUnique: `${modelName}`,
    update: modelName,
    updateMany: `${modelName}CountOutput`,
    upsert: modelName,
    delete: modelName,
    deleteMany: `${modelName}CountOutput`,
    count: `${modelName}CountOutput`,
    // Aggregate returns aggregate object; leave untyped (no output schema) for now
    aggregate: undefined,
    groupBy: `${modelName}Array`,
  };

  return outputTypeMap[opType];
}

/**
 * Check if an operation should be generated based on configuration
 */
export function shouldGenerateOperation(opType: string, config: Config): boolean {
  // Check if the operation is in the list of enabled operations
  return config.generateModelActions.includes(opType);
}

/**
 * Get HTTP method for an operation
 */
export function getHttpMethod(opType: string): string {
  const methodMap: Record<string, string> = {
    create: 'POST',
    createMany: 'POST',
    findFirst: 'GET',
    findMany: 'GET',
    findUnique: 'GET',
    update: 'PUT',
    updateMany: 'PUT',
    upsert: 'PUT',
    delete: 'DELETE',
    deleteMany: 'DELETE',
    count: 'GET',
    aggregate: 'GET',
    groupBy: 'GET',
  };

  return methodMap[opType] || 'POST';
}

/**
 * Get REST path pattern for an operation
 */
export function getRestPath(opType: string, modelName: string): string {
  const modelPath = modelName.toLowerCase();
  const pluralPath = `${modelPath}s`; // Simple pluralization

  const pathMap: Record<string, string> = {
    create: `/${pluralPath}`,
    createMany: `/${pluralPath}`,
    findFirst: `/${pluralPath}/first`,
    findMany: `/${pluralPath}`,
    findUnique: `/${pluralPath}/{id}`,
    update: `/${pluralPath}/{id}`,
    updateMany: `/${pluralPath}`,
    upsert: `/${pluralPath}/upsert`,
    delete: `/${pluralPath}/{id}`,
    deleteMany: `/${pluralPath}`,
    count: `/${pluralPath}/count`,
    aggregate: `/${pluralPath}/aggregate`,
    groupBy: `/${pluralPath}/group`,
  };

  return pathMap[opType] || `/${pluralPath}/${opType}`;
}

/**
 * Check if operation requires authentication
 */
export function requiresAuthentication(_opType: string, _config: Config): boolean {
  return false;
}

/**
 * Get operation description for documentation
 */
export function getOperationDescription(opType: string, modelName: string): string {
  const descriptions: Record<string, string> = {
    create: `Create a new ${modelName}`,
    createMany: `Create multiple ${modelName} records`,
    findFirst: `Find the first ${modelName} matching the criteria`,
    findMany: `Find multiple ${modelName} records with pagination`,
    findUnique: `Find a unique ${modelName} by ID or unique field`,
    update: `Update an existing ${modelName}`,
    updateMany: `Update multiple ${modelName} records`,
    upsert: `Create or update a ${modelName}`,
    delete: `Delete a ${modelName}`,
    deleteMany: `Delete multiple ${modelName} records`,
    count: `Count ${modelName} records matching the criteria`,
    aggregate: `Aggregate ${modelName} records`,
    groupBy: `Group ${modelName} records by specified fields`,
  };

  return descriptions[opType] || `Perform ${opType} operation on ${modelName}`;
}

/**
 * Get operation summary
 */
export function getOperationSummary(opType: string, modelName: string): string {
  const summaries: Record<string, string> = {
    create: `Create ${modelName}`,
    createMany: `Bulk create ${modelName}`,
    findFirst: `Get first ${modelName}`,
    findMany: `List ${modelName}`,
    findUnique: `Get ${modelName}`,
    update: `Update ${modelName}`,
    updateMany: `Bulk update ${modelName}`,
    upsert: `Upsert ${modelName}`,
    delete: `Delete ${modelName}`,
    deleteMany: `Bulk delete ${modelName}`,
    count: `Count ${modelName}`,
    aggregate: `Aggregate ${modelName}`,
    groupBy: `Group ${modelName}`,
  };

  return summaries[opType] || `${opType} ${modelName}`;
}

/**
 * Check if operation supports caching
 */
export function supportsCaching(opType: string): boolean {
  // Only read operations support caching
  const readOperations = ['findFirst', 'findMany', 'findUnique', 'count', 'aggregate', 'groupBy'];
  return readOperations.includes(opType);
}

/**
 * Check if operation returns multiple records
 */
export function returnsMultiple(opType: string): boolean {
  const multipleOperations = ['findMany', 'createMany', 'updateMany', 'deleteMany', 'groupBy'];
  return multipleOperations.includes(opType);
}

/**
 * Get validation requirements for operation
 */
export function getValidationRequirements(opType: string): ValidationRequirement {
  const requirements: Record<string, ValidationRequirement> = {
    create: { requiresInput: true, requiresOutput: true, inputOptional: false },
    createMany: { requiresInput: true, requiresOutput: true, inputOptional: false },
    findFirst: { requiresInput: true, requiresOutput: true, inputOptional: true },
    findMany: { requiresInput: true, requiresOutput: true, inputOptional: true },
    findUnique: { requiresInput: true, requiresOutput: true, inputOptional: false },
    update: { requiresInput: true, requiresOutput: true, inputOptional: false },
    updateMany: { requiresInput: true, requiresOutput: true, inputOptional: false },
    upsert: { requiresInput: true, requiresOutput: true, inputOptional: false },
    delete: { requiresInput: true, requiresOutput: true, inputOptional: false },
    deleteMany: { requiresInput: true, requiresOutput: true, inputOptional: false },
    count: { requiresInput: true, requiresOutput: true, inputOptional: true },
    aggregate: { requiresInput: true, requiresOutput: true, inputOptional: true },
    groupBy: { requiresInput: true, requiresOutput: true, inputOptional: false },
  };

  return (
    requirements[opType] || { requiresInput: true, requiresOutput: true, inputOptional: false }
  );
}

/**
 * Get the correct Prisma client method name for an operation
 */
export function getPrismaMethodName(opType: string): string {
  const methodMap: Record<string, string> = {
    create: 'create',
    createMany: 'createMany',
    findFirst: 'findFirst',
    findMany: 'findMany',
    findUnique: 'findUnique',
    update: 'update',
    updateMany: 'updateMany',
    upsert: 'upsert',
    delete: 'delete',
    deleteMany: 'deleteMany',
    count: 'count',
    aggregate: 'aggregate',
    groupBy: 'groupBy',
  };

  return methodMap[opType] || opType;
}
