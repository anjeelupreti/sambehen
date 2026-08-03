import { Inject } from '@nestjs/common';
import { eq, and, or, ilike, count, SQL, asc, desc, isNull, isNotNull, inArray } from 'drizzle-orm';
import { PgColumn, PgTable, TableConfig } from 'drizzle-orm/pg-core';
import { DRIZZLE_PROVIDER, DrizzleDB } from '../database.provider';
import { IPaginationOptions, IPaginatedResult } from '@common/interfaces/pagination.interface';
import { SortOrder } from '@common/constants/app.constants';

/** Options accepted by {@link BaseRepository.findPaginated}. */
export interface IFindPaginatedOptions {
  /** Extra WHERE predicates, ANDed together (scope predicates go here). */
  conditions?: SQL[];
  /** Columns the free-text `search` term is matched against, ORed together. */
  searchColumns?: PgColumn[];
  /**
   * Columns the caller is permitted to sort by. A `sortBy` outside this
   * list falls back to `defaultSort` rather than sorting by an arbitrary
   * client-supplied column name.
   */
  sortableColumns?: Record<string, PgColumn>;
  /** Ordering applied when no valid `sortBy` was supplied. */
  defaultSort?: { column: PgColumn; order: SortOrder };
  /** Include soft-deleted rows. Defaults to false. */
  includeDeleted?: boolean;
}

/**
 * Generic repository providing CRUD, soft delete, bulk operations and
 * pagination. Extend it per aggregate:
 *
 *   export class CustomerRepository extends BaseRepository<typeof customers> {
 *     constructor(@Inject(DRIZZLE_PROVIDER) db: DrizzleDB) {
 *       super(db, customers);
 *     }
 *   }
 *
 * Drizzle's conditional query-builder types cannot fully resolve while `T`
 * is an abstract generic rather than a concrete table, so the builder
 * boundary is widened to `any` at a few call sites. Public signatures still
 * return `T['$inferSelect']`, so subclasses keep full type safety.
 */
export abstract class BaseRepository<T extends PgTable<TableConfig>> {
  constructor(
    @Inject(DRIZZLE_PROVIDER)
    protected readonly db: DrizzleDB,
    protected readonly table: T,
  ) {}

  /** The table's primary key column. */
  protected get idColumn(): PgColumn {
    return (this.table as unknown as Record<string, PgColumn>)['id'];
  }

  /** The soft-delete column, when the table supports soft deletes. */
  protected get deletedAtColumn(): PgColumn | undefined {
    return (this.table as unknown as Record<string, PgColumn | undefined>)['deletedAt'];
  }

  /**
   * Predicate excluding soft-deleted rows, or undefined when the table has
   * no `deletedAt` column.
   */
  protected notDeleted(): SQL | undefined {
    const column = this.deletedAtColumn;
    return column ? isNull(column) : undefined;
  }

  /** Combines predicates, dropping undefined entries. Returns undefined when empty. */
  protected combine(...conditions: (SQL | undefined)[]): SQL | undefined {
    const present = conditions.filter((c): c is SQL => c !== undefined);
    return present.length > 0 ? and(...present) : undefined;
  }

  async findAll(conditions: SQL[] = [], includeDeleted = false): Promise<T['$inferSelect'][]> {
    const where = this.combine(...conditions, includeDeleted ? undefined : this.notDeleted());
    const query = this.db
      .select()
      .from(this.table as never)
      .$dynamic();
    if (where) query.where(where);
    return (await query) as T['$inferSelect'][];
  }

  async findById(id: string, includeDeleted = false): Promise<T['$inferSelect'] | undefined> {
    const where = this.combine(
      eq(this.idColumn, id),
      includeDeleted ? undefined : this.notDeleted(),
    );
    const rows = await this.db
      .select()
      .from(this.table as never)
      .where(where)
      .limit(1);
    return rows[0] as T['$inferSelect'] | undefined;
  }

  async findOneBy(
    conditions: SQL[],
    includeDeleted = false,
  ): Promise<T['$inferSelect'] | undefined> {
    const where = this.combine(...conditions, includeDeleted ? undefined : this.notDeleted());
    const rows = await this.db
      .select()
      .from(this.table as never)
      .where(where)
      .limit(1);
    return rows[0] as T['$inferSelect'] | undefined;
  }

  /**
   * Row count matching the predicates.
   *
   * Uses a COUNT(*) aggregate. The previous implementation selected every
   * matching row and read `.length`, which transferred the whole table to
   * the application just to produce a number.
   */
  async count(conditions: SQL[] = [], includeDeleted = false): Promise<number> {
    const where = this.combine(...conditions, includeDeleted ? undefined : this.notDeleted());
    const query = this.db
      .select({ value: count() })
      .from(this.table as never)
      .$dynamic();
    if (where) query.where(where);
    // Drizzle cannot narrow the row shape while `T` is an abstract generic,
    // so the aggregate's type is restated here.
    const [row] = (await query) as { value: number }[];
    return Number(row?.value ?? 0);
  }

  async exists(conditions: SQL[], includeDeleted = false): Promise<boolean> {
    const where = this.combine(...conditions, includeDeleted ? undefined : this.notDeleted());
    const rows = await this.db
      .select({ one: this.idColumn })
      .from(this.table as never)
      .where(where)
      .limit(1);
    return rows.length > 0;
  }

  async create(data: T['$inferInsert']): Promise<T['$inferSelect']> {
    const [row] = await this.db
      .insert(this.table)
      .values(data as never)
      .returning();
    return row as T['$inferSelect'];
  }

  async createMany(data: T['$inferInsert'][]): Promise<T['$inferSelect'][]> {
    if (data.length === 0) return [];
    const rows = await this.db
      .insert(this.table)
      .values(data as never)
      .returning();
    return rows as T['$inferSelect'][];
  }

  async update(
    id: string,
    data: Partial<T['$inferInsert']>,
  ): Promise<T['$inferSelect'] | undefined> {
    const rows = (await this.db
      .update(this.table)
      .set(data as never)
      .where(eq(this.idColumn, id))
      .returning()) as T['$inferSelect'][];
    return rows[0];
  }

  async updateMany(ids: string[], data: Partial<T['$inferInsert']>): Promise<T['$inferSelect'][]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .update(this.table)
      .set(data as never)
      .where(inArray(this.idColumn, ids))
      .returning();
    return rows as T['$inferSelect'][];
  }

  /** Permanently removes the row. Prefer {@link softDelete} for auditable data. */
  async delete(id: string): Promise<T['$inferSelect'] | undefined> {
    const rows = (await this.db
      .delete(this.table)
      .where(eq(this.idColumn, id))
      .returning()) as T['$inferSelect'][];
    return rows[0];
  }

  async softDelete(id: string): Promise<T['$inferSelect'] | undefined> {
    return this.update(id, { deletedAt: new Date() } as Partial<T['$inferInsert']>);
  }

  async restore(id: string): Promise<T['$inferSelect'] | undefined> {
    return this.update(id, { deletedAt: null } as Partial<T['$inferInsert']>);
  }

  async findDeleted(conditions: SQL[] = []): Promise<T['$inferSelect'][]> {
    const column = this.deletedAtColumn;
    const where = this.combine(...conditions, column ? isNotNull(column) : undefined);
    const query = this.db
      .select()
      .from(this.table as never)
      .$dynamic();
    if (where) query.where(where);
    return (await query) as T['$inferSelect'][];
  }

  /**
   * Offset pagination with optional multi-column search and whitelisted
   * sorting. Data and count are derived from the same WHERE clause, so the
   * two can never disagree.
   */
  async findPaginated(
    options: IPaginationOptions,
    findOptions: IFindPaginatedOptions = {},
  ): Promise<IPaginatedResult<T['$inferSelect']>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, options.limit ?? 10);
    const offset = (page - 1) * limit;

    const {
      conditions = [],
      searchColumns = [],
      sortableColumns = {},
      defaultSort,
      includeDeleted = false,
    } = findOptions;

    const predicates: (SQL | undefined)[] = [
      ...conditions,
      includeDeleted ? undefined : this.notDeleted(),
    ];

    // Free-text search is ORed across every searchable column.
    const term = options.search?.trim();
    if (term && searchColumns.length > 0) {
      const pattern = `%${this.escapeLike(term)}%`;
      predicates.push(or(...searchColumns.map((column) => ilike(column, pattern))));
    }

    const where = this.combine(...predicates);

    const query = this.db
      .select()
      .from(this.table as never)
      .$dynamic();
    if (where) query.where(where);

    // Sorting is restricted to the caller-supplied whitelist so a client
    // cannot order by an arbitrary column name.
    const direction = options.sortOrder === SortOrder.DESC ? desc : asc;
    const requested = options.sortBy ? sortableColumns[options.sortBy] : undefined;
    const orderBy: SQL[] = [];

    if (requested) {
      orderBy.push(direction(requested));
    } else if (defaultSort) {
      orderBy.push(
        defaultSort.order === SortOrder.DESC ? desc(defaultSort.column) : asc(defaultSort.column),
      );
    }

    // Always tie-break on the primary key. Without a unique final sort key,
    // rows with equal sort values can repeat or vanish between pages.
    orderBy.push(asc(this.idColumn));
    query.orderBy(...orderBy);

    // Page and count run against the identical WHERE clause, so `meta.total`
    // can never disagree with the rows returned.
    const [data, total] = await Promise.all([
      query.limit(limit).offset(offset) as Promise<T['$inferSelect'][]>,
      this.countWhere(where),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /** COUNT(*) over an already-assembled WHERE clause. */
  protected async countWhere(where: SQL | undefined): Promise<number> {
    const query = this.db
      .select({ value: count() })
      .from(this.table as never)
      .$dynamic();
    if (where) query.where(where);
    // Drizzle cannot narrow the row shape while `T` is an abstract generic,
    // so the aggregate's type is restated here.
    const [row] = (await query) as { value: number }[];
    return Number(row?.value ?? 0);
  }

  /**
   * Escapes LIKE wildcards so a search for "100%" matches the literal text
   * rather than acting as a wildcard.
   */
  protected escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }
}
