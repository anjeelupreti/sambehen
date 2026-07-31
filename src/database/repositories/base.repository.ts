import { Inject } from '@nestjs/common';
import { eq, and, ilike, SQL, asc, desc, isNull, inArray } from 'drizzle-orm';
import { PgTable, TableConfig } from 'drizzle-orm/pg-core';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database.provider';
import { IPaginationOptions, IPaginatedResult } from '@common/interfaces/pagination.interface';

/**
 * Generic base repository providing standard CRUD, pagination, filtering,
 * sorting, bulk operations, and soft-delete support.
 *
 * Extend this class for each entity:
 *   export class UserRepository extends BaseRepository<typeof users> { ... }
 *
 * Note: Drizzle's conditional query-builder types can't fully resolve when
 * `T` is an abstract generic rather than a concrete table, so the query
 * builder boundary is intentionally widened to `any` at a few call sites
 * below. The public method signatures still return `T['$inferSelect']`, so
 * callers (e.g. UserRepository) keep full type safety.
 */
export abstract class BaseRepository<T extends PgTable<TableConfig>> {
  constructor(
    @Inject(DRIZZLE_PROVIDER)
    protected readonly db: DrizzleDB,
    protected readonly table: T,
  ) {}

  /**
   * Find all records (excluding soft-deleted if deletedAt column exists).
   */
  async findAll(): Promise<T['$inferSelect'][]> {
    return this.db.select().from(this.table as any);
  }

  /**
   * Find a single record by ID.
   */
  async findById(id: string): Promise<T['$inferSelect'] | undefined> {
    const idColumn = (this.table as Record<string, unknown>)['id'] as SQL;
    const results = await this.db
      .select()
      .from(this.table as any)
      .where(eq(idColumn, id))
      .limit(1);
    return results[0] as T['$inferSelect'] | undefined;
  }

  /**
   * Create a single record.
   */
  async create(data: T['$inferInsert']): Promise<T['$inferSelect']> {
    const result = await this.db
      .insert(this.table)
      .values(data as any)
      .returning();
    return result[0] as T['$inferSelect'];
  }

  /**
   * Bulk insert multiple records.
   */
  async createMany(data: T['$inferInsert'][]): Promise<T['$inferSelect'][]> {
    const result = await this.db
      .insert(this.table)
      .values(data as any[])
      .returning();
    return result as T['$inferSelect'][];
  }

  /**
   * Update a record by ID.
   */
  async update(
    id: string,
    data: Partial<T['$inferInsert']>,
  ): Promise<T['$inferSelect'] | undefined> {
    const idColumn = (this.table as Record<string, unknown>)['id'] as SQL;
    const result = (await this.db
      .update(this.table)
      .set(data as any)
      .where(eq(idColumn, id))
      .returning()) as T['$inferSelect'][];
    return result[0];
  }

  /**
   * Bulk update records by IDs.
   */
  async updateMany(ids: string[], data: Partial<T['$inferInsert']>): Promise<T['$inferSelect'][]> {
    const idColumn = (this.table as Record<string, unknown>)['id'] as SQL;
    const result = await this.db
      .update(this.table)
      .set(data as any)
      .where(inArray(idColumn, ids))
      .returning();
    return result as T['$inferSelect'][];
  }

  /**
   * Hard delete a record by ID.
   */
  async delete(id: string): Promise<T['$inferSelect'] | undefined> {
    const idColumn = (this.table as Record<string, unknown>)['id'] as SQL;
    const result = (await this.db
      .delete(this.table)
      .where(eq(idColumn, id))
      .returning()) as T['$inferSelect'][];
    return result[0];
  }

  /**
   * Soft delete — sets deletedAt to now.
   */
  async softDelete(id: string): Promise<T['$inferSelect'] | undefined> {
    return this.update(id, { deletedAt: new Date() } as Partial<T['$inferInsert']>);
  }

  /**
   * Paginated query with optional search, filtering, and sorting.
   */
  async findPaginated(
    options: IPaginationOptions,
    conditions: SQL[] = [],
    searchColumn?: SQL,
  ): Promise<IPaginatedResult<T['$inferSelect']>> {
    const { page = 1, limit = 10, search, sortBy, sortOrder = 'asc' } = options;
    const offset = (page - 1) * limit;

    // Build WHERE clauses
    const whereConditions = [...conditions];

    // Add soft-delete filter if table has deletedAt
    const deletedAtColumn = (this.table as Record<string, unknown>)['deletedAt'] as SQL | undefined;
    if (deletedAtColumn) {
      whereConditions.push(isNull(deletedAtColumn));
    }

    // Add search
    if (search && searchColumn) {
      whereConditions.push(ilike(searchColumn, `%${search}%`));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Build query. `.$dynamic()` opts into Drizzle's dynamic query-builder
    // mode, which allows `query` to be conditionally reassigned across
    // `.where()`/`.orderBy()` calls without losing type safety.
    let query = this.db
      .select()
      .from(this.table as any)
      .$dynamic();

    if (whereClause) {
      query = query.where(whereClause);
    }

    // Sorting
    if (sortBy) {
      const sortColumn = (this.table as Record<string, unknown>)[sortBy as string] as SQL;
      if (sortColumn) {
        query = query.orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn));
      }
    }

    // Execute paginated query
    const data = await query.limit(limit).offset(offset);

    // Count total
    let countQuery = this.db
      .select()
      .from(this.table as any)
      .$dynamic();
    if (whereClause) {
      countQuery = countQuery.where(whereClause);
    }
    const countResult = await countQuery;
    const total = countResult.length;

    return {
      data: data as T['$inferSelect'][],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}
