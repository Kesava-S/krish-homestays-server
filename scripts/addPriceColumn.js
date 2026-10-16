require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');

async function migrate() {
    const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('Missing database connection string');
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // 1. Add price column if not exists
    await client.query(`
        ALTER TABLE public.calendar_rules 
        ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT NULL;
    `);
    console.log('Added column "price" to calendar_rules.');

    // 2. Allow 'available' and 'custom_price' in rule_type check constraint
    await client.query(`
        ALTER TABLE public.calendar_rules 
        DROP CONSTRAINT IF EXISTS chk_calendar_rules_rule_type;
    `);
    await client.query(`
        ALTER TABLE public.calendar_rules 
        ADD CONSTRAINT chk_calendar_rules_rule_type 
        CHECK (rule_type IN ('booked', 'blocked', 'available', 'custom_price'));
    `);
    console.log('Updated constraint chk_calendar_rules_rule_type.');

    // 3. Verify columns
    const res = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'calendar_rules'
        ORDER BY ordinal_position;
    `);
    console.log('Current calendar_rules columns:', res.rows.map(r => `${r.column_name} (${r.data_type})`));

    await client.end();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
