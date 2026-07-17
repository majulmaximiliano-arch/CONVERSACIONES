/**
 * Backfill script: create dynamic file_data_N tables for existing confirmed files
 * that don't have a table_name yet. Reads rows from data_rows (up to 1000 per file).
 */
import pg from '/home/runner/workspace/node_modules/.pnpm/pg@8.22.0/node_modules/pg/lib/index.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function sanitizeColName(name) {
  const s = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/^(\d)/, '_$1')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63);
  return s || 'col';
}

function buildColumnSchema(columns) {
  const seen = new Map();
  return columns.map(col => {
    let sanitized = sanitizeColName(col.name);
    const count = seen.get(sanitized) ?? 0;
    seen.set(sanitized, count + 1);
    if (count > 0) sanitized = `${sanitized}_${count}`;
    return { originalName: col.name, sanitizedName: sanitized, detectedType: col.detected_type };
  });
}

async function backfill() {
  const client = await pool.connect();
  try {
    // Get all files without table_name
    const { rows: files } = await client.query(
      `SELECT id, original_filename FROM data_files WHERE table_name IS NULL ORDER BY id`
    );
    console.log(`Found ${files.length} files to backfill`);

    for (const file of files) {
      console.log(`\nProcessing file ${file.id}: ${file.original_filename}`);

      // Get columns
      const { rows: columns } = await client.query(
        `SELECT name, detected_type FROM file_columns WHERE file_id = $1 ORDER BY id`,
        [file.id]
      );
      if (columns.length === 0) {
        console.log(`  No columns found, skipping`);
        continue;
      }

      // Get rows from data_rows
      const { rows: dataRows } = await client.query(
        `SELECT row_data FROM data_rows WHERE file_id = $1 ORDER BY id`,
        [file.id]
      );
      if (dataRows.length === 0) {
        console.log(`  No rows found, skipping`);
        continue;
      }

      const columnSchema = buildColumnSchema(columns);
      const tableName = `file_data_${file.id}`;

      // Create dynamic table
      const colDefs = columnSchema.map(c => `"${c.sanitizedName}" text`).join(', ');
      await client.query(`CREATE TABLE IF NOT EXISTS ${tableName} (_row_id serial PRIMARY KEY, ${colDefs})`);
      console.log(`  Created table ${tableName} with ${columnSchema.length} columns`);

      // Insert rows in batches
      const BATCH = 200;
      let inserted = 0;
      for (let i = 0; i < dataRows.length; i += BATCH) {
        const batch = dataRows.slice(i, i + BATCH);
        const values = [];
        const placeholders = batch.map((r, bIdx) => {
          const rowData = r.row_data;
          const rowPlaceholders = columnSchema.map((c, cIdx) => {
            const val = rowData[c.originalName];
            values.push(val === null || val === undefined ? null : String(val));
            return `$${(bIdx * columnSchema.length) + cIdx + 1}`;
          });
          return `(${rowPlaceholders.join(', ')})`;
        }).join(', ');

        const colList = columnSchema.map(c => `"${c.sanitizedName}"`).join(', ');
        await client.query(
          `INSERT INTO ${tableName} (${colList}) VALUES ${placeholders}`,
          values
        );
        inserted += batch.length;
      }
      console.log(`  Inserted ${inserted} rows`);

      // Update data_files with table metadata
      await client.query(
        `UPDATE data_files SET table_name = $1, column_schema = $2 WHERE id = $3`,
        [tableName, JSON.stringify(columnSchema), file.id]
      );
      console.log(`  Updated data_files record`);
    }

    console.log('\n✅ Backfill complete');
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
