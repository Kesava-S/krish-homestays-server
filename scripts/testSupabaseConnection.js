/**
 * Supabase Connection Test Script
 * Run with: node scripts/testSupabaseConnection.js
 * or: npm run test:db
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
    console.log('='.repeat(50));
    console.log('  SUPABASE CONNECTION TEST');
    console.log('='.repeat(50));

    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const genericKey = process.env.SUPABASE_KEY;

    const activeKey = serviceRoleKey || genericKey || anonKey;
    const keyType = serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY (bypasses RLS - recommended)' : (genericKey ? 'SUPABASE_KEY' : (anonKey ? 'SUPABASE_ANON_KEY' : 'NONE'));

    console.log(`URL:       ${url ? url : '❌ NOT SET'}`);
    console.log(`Key Type:  ${keyType}`);
    console.log(`Key State: ${activeKey ? `✅ Found (${activeKey.slice(0, 10)}...${activeKey.slice(-6)})` : '❌ NOT SET'}`);
    console.log('-'.repeat(50));

    if (!url || !activeKey || url.includes('your-project-id')) {
        console.error('❌ Connection test aborted.');
        console.error('   Please provide valid SUPABASE_URL and SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY in server/.env');
        process.exit(1);
    }

    try {
        console.log('Connecting to Supabase...');
        const supabase = createClient(url, activeKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        // Test bookings table
        console.log('Checking "bookings" table...');
        const { data: bookings, error: bookingsErr } = await supabase.from('bookings').select('id, booking_id').limit(1);

        if (bookingsErr) {
            if (bookingsErr.code === '42P01') {
                console.warn('⚠️ Table "bookings" does not exist yet.');
                console.warn('   Run the SQL statements in server/supabase_schema.sql in your Supabase SQL Editor.');
            } else {
                console.error(`❌ Error querying "bookings": ${bookingsErr.message} (${bookingsErr.code})`);
            }
        } else {
            console.log('✅ "bookings" table accessed successfully!');
        }

        // Test calendar_rules table
        console.log('Checking "calendar_rules" table...');
        const { data: rules, error: rulesErr } = await supabase.from('calendar_rules').select('id, start_date, end_date').limit(1);

        if (rulesErr) {
            if (rulesErr.code === '42P01') {
                console.warn('⚠️ Table "calendar_rules" does not exist yet.');
            } else {
                console.error(`❌ Error querying "calendar_rules": ${rulesErr.message} (${rulesErr.code})`);
            }
        } else {
            console.log('✅ "calendar_rules" table accessed successfully!');
        }

        // Test reviews table
        console.log('Checking "reviews" table...');
        const { data: reviews, error: reviewsErr } = await supabase.from('reviews').select('id').limit(1);

        if (reviewsErr) {
            if (reviewsErr.code === '42P01') {
                console.warn('⚠️ Table "reviews" does not exist yet.');
            } else {
                console.error(`❌ Error querying "reviews": ${reviewsErr.message} (${reviewsErr.code})`);
            }
        } else {
            console.log('✅ "reviews" table accessed successfully!');
        }

        // Test app_logs, app_error_logs, user_logs
        console.log('Checking "app_logs" table...');
        const { error: appLogsErr } = await supabase.from('app_logs').select('id').limit(1);
        if (!appLogsErr) console.log('✅ "app_logs" table accessed successfully!');

        console.log('Checking "app_error_logs" table...');
        const { error: appErrorLogsErr } = await supabase.from('app_error_logs').select('id').limit(1);
        if (!appErrorLogsErr) console.log('✅ "app_error_logs" table accessed successfully!');

        console.log('Checking "user_logs" table...');
        const { error: userLogsErr } = await supabase.from('user_logs').select('id').limit(1);
        if (!userLogsErr) console.log('✅ "user_logs" table accessed successfully!');

        console.log('='.repeat(50));
        if (!bookingsErr && !rulesErr && !reviewsErr) {
            console.log('🎉 Supabase database is completely connected and ready!');
        } else if (!bookingsErr) {
            console.log('👍 Connected to Supabase! (Some auxiliary tables may need creation)');
        } else {
            console.log('⚠️ Connected to Supabase project, but database tables need to be created.');
        }
        console.log('='.repeat(50));
    } catch (err) {
        console.error('❌ Connection failed with exception:', err.message);
        process.exit(1);
    }
}

testSupabase();
