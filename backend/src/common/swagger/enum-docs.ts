/**
 * Helpers for documenting constrained values.
 *
 * `@ApiProperty({ enum })` alone renders the allowed values but emits an
 * anonymous inline schema, so a generated client gets a bare union of
 * string literals repeated at every use site rather than one named type.
 * Passing `enumName` makes Swagger emit a reusable named schema instead.
 *
 * These helpers keep the enum, its name and a human explanation of each
 * value together, so the documentation cannot drift from the values the
 * validator actually accepts.
 */

interface IEnumDocOptions {
  description?: string;
  /** Per-value explanation, appended to the description as a list. */
  meanings?: Record<string, string>;
  example?: unknown;
  isArray?: boolean;
  nullable?: boolean;
  required?: boolean;
  default?: unknown;
}

/**
 * Builds `@ApiProperty` options for an enum-typed field.
 *
 *   @ApiProperty(enumDoc(TransactionType, 'TransactionType', {
 *     meanings: { debit: 'money IN', credit: 'money OUT' },
 *   }))
 */
export function enumDoc(
  enumType: Record<string, string | number>,
  enumName: string,
  options: IEnumDocOptions = {},
): Record<string, unknown> {
  const values = Object.values(enumType).filter((v) => typeof v === 'string') as string[];

  const lines: string[] = [];
  if (options.description) lines.push(options.description);

  if (options.meanings) {
    lines.push('', 'Allowed values:');
    for (const value of values) {
      const meaning = options.meanings[value];
      lines.push(meaning ? `- \`${value}\` — ${meaning}` : `- \`${value}\``);
    }
  } else {
    lines.push(`Allowed values: ${values.map((v) => `\`${v}\``).join(', ')}.`);
  }

  return {
    enum: values,
    enumName,
    description: lines.join('\n'),
    ...(options.example !== undefined ? { example: options.example } : { example: values[0] }),
    ...(options.isArray ? { isArray: true } : {}),
    ...(options.nullable ? { nullable: true } : {}),
    ...(options.default !== undefined ? { default: options.default } : {}),
  };
}

/**
 * Builds `@ApiPropertyOptional` options for a `sortBy` field.
 *
 * The base PaginationQueryDto types `sortBy` as a free string because the
 * permitted columns differ per resource. Each filter DTO overrides it with
 * its own list so the documentation names the exact set, and the repository
 * whitelist rejects anything else rather than sorting by an arbitrary
 * client-supplied column.
 */
export function sortByDoc(
  fields: readonly string[],
  defaultField?: string,
): Record<string, unknown> {
  return {
    enum: [...fields],
    description: `Column to sort by. One of: ${fields.map((f) => `\`${f}\``).join(', ')}.${
      defaultField ? ` Defaults to \`${defaultField}\`.` : ''
    }`,
    example: defaultField ?? fields[0],
  };
}
