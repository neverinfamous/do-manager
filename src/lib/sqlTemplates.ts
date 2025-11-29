/**
 * SQL query template definition
 */
export interface SqlTemplate {
  id: string
  name: string
  description: string
  /** Generate query - receives table name or undefined for table-agnostic queries */
  generateQuery: (tableName?: string) => string
  /** Whether this template requires a table to be selected */
  requiresTable: boolean
}

/**
 * Pre-built SQL query templates for common operations
 */
export const sqlTemplates: SqlTemplate[] = [
  {
    id: 'select-all',
    name: 'Select All Rows',
    description: 'Retrieve all rows from a table (limited to 100)',
    generateQuery: (tableName) => `SELECT * FROM ${tableName ?? 'table_name'} LIMIT 100`,
    requiresTable: true,
  },
  {
    id: 'row-count',
    name: 'Row Count',
    description: 'Count total rows in a table',
    generateQuery: (tableName) => `SELECT COUNT(*) as row_count FROM ${tableName ?? 'table_name'}`,
    requiresTable: true,
  },
  {
    id: 'table-schema',
    name: 'Table Schema',
    description: 'View column names and types for a table',
    generateQuery: (tableName) => `PRAGMA table_info(${tableName ?? 'table_name'})`,
    requiresTable: true,
  },
  {
    id: 'list-tables',
    name: 'List All Tables',
    description: 'Show all tables in the database',
    generateQuery: () => `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    requiresTable: false,
  },
  {
    id: 'list-indexes',
    name: 'List Indexes',
    description: 'Show all indexes for a table',
    generateQuery: (tableName) => `PRAGMA index_list(${tableName ?? 'table_name'})`,
    requiresTable: true,
  },
  {
    id: 'sample-rows',
    name: 'Sample Rows',
    description: 'Get 10 random sample rows from a table',
    generateQuery: (tableName) => `SELECT * FROM ${tableName ?? 'table_name'} ORDER BY RANDOM() LIMIT 10`,
    requiresTable: true,
  },
]

/**
 * Get templates filtered by whether they require a table
 */
export function getAvailableTemplates(hasSelectedTable: boolean): SqlTemplate[] {
  return sqlTemplates.filter((t) => !t.requiresTable || hasSelectedTable)
}

