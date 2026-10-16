require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runSchema() {
    const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('❌ Error: SUPABASE_DB_URL or DATABASE_URL is not defined in server/.env');
        process.exit(1);
    }

    console.log('Connecting to PostgreSQL database...');
    console.log(`Host: ${connectionString.split('@')[1] ? connectionString.split('@')[1] : '...'}`);

    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully to Supabase PostgreSQL database!');

        const sqlPath = path.resolve(__dirname, '../supabase_schema.sql');
        let sql = fs.readFileSync(sqlPath, 'utf8');

        // Ensure RLS policies allow access for anon key as well
        const policiesSql = `
-- Permissive policies for Krish Homestay
DROP POLICY IF EXISTS "Allow all for bookings" ON public.bookings;
CREATE POLICY "Allow all for bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for calendar_rules" ON public.calendar_rules;
CREATE POLICY "Allow all for calendar_rules" ON public.calendar_rules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for reviews" ON public.reviews;
CREATE POLICY "Allow all for reviews" ON public.reviews FOR ALL USING (true) WITH CHECK (true);
`;

        console.log('Executing schema SQL statements...');
        await client.query(sql);
        console.log('✅ Schema tables and indexes created successfully!');

        console.log('Applying Row Level Security policies...');
        await client.query(policiesSql);
        console.log('✅ RLS policies applied successfully!');

        // Verify tables exist
        const tablesCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN ('bookings', 'calendar_rules', 'reviews');
        `);

        console.log('Tables found in database:', tablesCheck.rows.map(r => r.table_name).join(', '));
        console.log('🎉 Supabase schema migration completed successfully!');

        await client.end();
    } catch (err) {
        console.error('❌ Failed to run schema:', err.message);
        try { await client.end(); } catch (e) {}
        process.exit(1);
    }
}

runSchema();
