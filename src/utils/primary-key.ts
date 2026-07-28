/**
 * Primary key derivation.
 *
 * Generated code has to address a single record by its unique identifier in several places:
 * relation resolvers, the `groupBy` fallback grouping, and the mock data in generated tests.
 * None of that can assume the identifier is a `String` called `id`. Prisma models routinely use
 * an `Int` autoincrement, a differently named column, a `BigInt`, a `DateTime`, or a composite
 * `@@id`, and a model may carry no `@id` at all and be addressed through a unique constraint.
 *
 * Everything needed is already in the DMMF, so it is derived here once and reused rather than
 * guessed at each call site.
 */

export interface PrimaryKeyFieldLike {
  name: string;
  type: string;
  kind?: string;
  isId?: boolean;
  isUnique?: boolean;
  isList?: boolean;
}

export interface PrimaryKeyModelLike {
  name: string;
  fields: PrimaryKeyFieldLike[];
  primaryKey?: { name?: string | null; fields: string[] } | null;
  uniqueFields?: string[][];
  uniqueIndexes?: Array<{ name?: string | null; fields: string[] }>;
}

export interface PrimaryKeyInfo {
  /** The field(s) that identify one record. Always at least one entry. */
  fields: PrimaryKeyFieldLike[];
  /** True when more than one field is needed, i.e. `@@id` / `@@unique`. */
  isComposite: boolean;
  /**
   * The key Prisma exposes inside `WhereUniqueInput` for a composite key, e.g. `postSlug_label`
   * for `@@id([postSlug, label])`, or the explicit `name:` argument when one was given.
   * Undefined for single-field keys, which are addressed by the field name directly.
   */
  compoundKey?: string;
  /** True when the key came from a unique constraint because the model declares no `@id`. */
  fromUniqueConstraint: boolean;
}

/** Prisma scalar types whose zod schema and TypeScript type we can state exactly. */
const SCALAR_ZOD: Record<string, { zod: string; ts: string }> = {
  String: { zod: 'z.string()', ts: 'string' },
  Int: { zod: 'z.number().int()', ts: 'number' },
  BigInt: { zod: 'z.bigint()', ts: 'bigint' },
  Float: { zod: 'z.number()', ts: 'number' },
  Decimal: { zod: 'z.union([z.number(), z.string()])', ts: 'number | string' },
  Boolean: { zod: 'z.boolean()', ts: 'boolean' },
  DateTime: { zod: 'z.coerce.date()', ts: 'Date' },
  Bytes: { zod: 'z.instanceof(Uint8Array)', ts: 'Uint8Array' },
};

function findField(model: PrimaryKeyModelLike, name: string): PrimaryKeyFieldLike | undefined {
  return model.fields.find((f) => f.name === name);
}

/**
 * Resolve the fields that uniquely identify one record of `model`.
 *
 * Returns undefined only when the model exposes no identifier at all, in which case callers must
 * skip emitting code that addresses a single record rather than emit something that cannot work.
 */
export function getPrimaryKeyInfo(model: PrimaryKeyModelLike): PrimaryKeyInfo | undefined {
  // `@@id([a, b])`. Prisma leaves `isId` false on the member fields and reports the key here.
  const composite = model.primaryKey;
  if (composite && composite.fields && composite.fields.length > 0) {
    const fields = composite.fields
      .map((name) => findField(model, name))
      .filter((f): f is PrimaryKeyFieldLike => !!f);
    if (fields.length === composite.fields.length) {
      return {
        fields,
        isComposite: fields.length > 1,
        compoundKey: fields.length > 1 ? composite.name || composite.fields.join('_') : undefined,
        fromUniqueConstraint: false,
      };
    }
  }

  // `@id` on a single field.
  const idFields = model.fields.filter((f) => f.isId && !f.isList);
  if (idFields.length === 1) {
    return { fields: idFields, isComposite: false, fromUniqueConstraint: false };
  }
  if (idFields.length > 1) {
    // Defensive: some DMMF producers mark every member of a composite key.
    return {
      fields: idFields,
      isComposite: true,
      compoundKey: idFields.map((f) => f.name).join('_'),
      fromUniqueConstraint: false,
    };
  }

  // No `@id`: a model addressed through `@unique`.
  const uniqueField = model.fields.find(
    (f) => f.isUnique && !f.isList && (f.kind ?? 'scalar') !== 'object'
  );
  if (uniqueField) {
    return { fields: [uniqueField], isComposite: false, fromUniqueConstraint: true };
  }

  // No `@id`: a model addressed through `@@unique([a, b])`.
  const uniqueGroups = model.uniqueFields ?? [];
  for (let i = 0; i < uniqueGroups.length; i++) {
    const group = uniqueGroups[i];
    if (!group || group.length === 0) continue;
    const fields = group
      .map((name) => findField(model, name))
      .filter((f): f is PrimaryKeyFieldLike => !!f);
    if (fields.length !== group.length) continue;
    const index = (model.uniqueIndexes ?? []).find(
      (idx) => idx.fields.length === group.length && idx.fields.every((f, j) => f === group[j])
    );
    return {
      fields,
      isComposite: fields.length > 1,
      compoundKey: fields.length > 1 ? index?.name || group.join('_') : undefined,
      fromUniqueConstraint: true,
    };
  }

  return undefined;
}

/** The zod expression validating one primary key field. */
export function zodExpressionForField(field: PrimaryKeyFieldLike): string {
  if ((field.kind ?? 'scalar') === 'scalar') {
    const mapped = SCALAR_ZOD[field.type];
    if (mapped) return mapped.zod;
  }
  // Enums and connector-specific scalars arrive as strings over the wire.
  return 'z.string()';
}

/** The TypeScript type of one primary key field as it arrives from the zod schema above. */
export function tsTypeForField(field: PrimaryKeyFieldLike): string {
  if ((field.kind ?? 'scalar') === 'scalar') {
    const mapped = SCALAR_ZOD[field.type];
    if (mapped) return mapped.ts;
  }
  return 'string';
}

/**
 * True when the validated input types cannot be handed to Prisma without an assertion, i.e. the
 * key involves an enum or a connector-specific scalar we deliberately accept as a string.
 */
export function primaryKeyNeedsAssertion(pk: PrimaryKeyInfo): boolean {
  return pk.fields.some((f) => (f.kind ?? 'scalar') !== 'scalar' || !SCALAR_ZOD[f.type]);
}

/** `z.object({ ... })` body validating the whole key. */
export function primaryKeyZodObject(pk: PrimaryKeyInfo): string {
  return `z.object({ ${pk.fields
    .map((f) => `${f.name}: ${zodExpressionForField(f)}`)
    .join(', ')} })`;
}

/** The TypeScript shape of the validated key input. */
export function primaryKeyInputType(pk: PrimaryKeyInfo): string {
  return `{ ${pk.fields.map((f) => `${f.name}: ${tsTypeForField(f)}`).join('; ')} }`;
}

/**
 * A `WhereUniqueInput` object literal reading each key field off `accessor`.
 * Composite keys are nested under the compound key Prisma generates for them.
 */
export function primaryKeyWhereLiteral(pk: PrimaryKeyInfo, accessor: string): string {
  const entries = pk.fields.map((f) => `${f.name}: ${accessor}.${f.name}`).join(', ');
  if (pk.isComposite && pk.compoundKey) {
    return `{ ${pk.compoundKey}: { ${entries} } }`;
  }
  return `{ ${entries} }`;
}

/** Names of the primary key fields, in schema order. */
export function primaryKeyFieldNames(model: PrimaryKeyModelLike): string[] {
  return getPrimaryKeyInfo(model)?.fields.map((f) => f.name) ?? [];
}
