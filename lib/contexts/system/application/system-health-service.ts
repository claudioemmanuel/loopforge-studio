/**
 * System Health Service (Application Layer)
 */

import { SystemHealthRepository } from "../infrastructure/system-health-repository";

export class SystemHealthService {
  private repository: SystemHealthRepository;

  constructor(repository?: SystemHealthRepository) {
    this.repository = repository || new SystemHealthRepository();
  }

  async checkDatabaseConnection(): Promise<boolean> {
    await this.repository.checkConnection();
    return true;
  }

  async validateColumns(
    requiredColumns: Array<{ table: string; column: string }>,
  ) {
    const missingColumns: string[] = [];

    for (const { table, column } of requiredColumns) {
      try {
        const result = await this.repository.getColumnInfo(table, column);

        if (result.rows.length === 0) {
          missingColumns.push(`${table}.${column}`);
        }
      } catch {
        missingColumns.push(`${table}.${column} (check failed)`);
      }
    }

    return {
      valid: missingColumns.length === 0,
      missingColumns,
    };
  }
}
