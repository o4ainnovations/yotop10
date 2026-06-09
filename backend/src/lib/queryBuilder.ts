export class QueryBuilder {
  private conditions: Record<string, unknown> = {};
  private orConditions: Record<string, unknown>[] = [];

  constructor(defaultQuery: Record<string, unknown> = {}) {
    this.conditions = { ...defaultQuery };
  }

  and(field: string, value: unknown): this {
    this.conditions[field] = value;
    return this;
  }

  andNot(field: string, value: unknown): this {
    this.conditions[field] = { $ne: value };
    return this;
  }

  or(...conditions: Record<string, unknown>[]): this {
    this.orConditions.push(...conditions);
    return this;
  }

  dateRange(field: string, from?: string, to?: string): this {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) range.$lte = new Date(to);
    if (Object.keys(range).length > 0) {
      this.conditions[field] = range;
    }
    return this;
  }

  search(text: string, fields: string[]): this {
    if (text && fields.length > 0) {
      this.orConditions.push({
        $or: fields.map(f => ({ [f]: { $regex: text, $options: 'i' } })),
      });
    }
    return this;
  }

  safeRegex(field: string, value: string): this {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.conditions[field] = { $regex: escaped, $options: 'i' };
    return this;
  }

  build(): Record<string, unknown> {
    const query = { ...this.conditions };
    if (this.orConditions.length > 0) {
      query.$or = this.orConditions;
    }
    return query;
  }
}

export function sanitizeQueryParams(
  query: Record<string, unknown>
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && /(\$gt|\$gte|\$lt|\$lte|\$ne|\$in|\$nin|\$regex|\$exists|\$where)/i.test(value)) {
      continue;
    }
    if (typeof value === 'string' && value.length > 500) continue;
    clean[key] = value;
  }
  return clean;
}
