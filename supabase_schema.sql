-- ============================================================================
-- KRISH HOMESTAYS - SUPABASE (POSTGRESQL) SCHEMA MIGRATION
-- Migration for n8n workflows (WhatsApp, Instagram, Facebook, Booking, Cancellation, Reviews)
-- Plus Application Logs, Application Error Logs, and User Activity Logs
-- ============================================================================

-- Ensure pgcrypto extension is available for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 0. CLEANUP EXISTING TABLES
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.refunds CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.calendar_rules CASCADE;
DROP TABLE IF EXISTS public.chat_sessions CASCADE;
DROP TABLE IF EXISTS public.whatsapp_leads CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.error_logs CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.app_logs CASCADE;
DROP TABLE IF EXISTS public.app_error_logs CASCADE;
DROP TABLE IF EXISTS public.user_logs CASCADE;

-- ----------------------------------------------------------------------------
-- TRIGGER FUNCTION: update_updated_at_column
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. BOOKINGS TABLE
-- Main record for each booking or enquiry
-- ----------------------------------------------------------------------------
CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL UNIQUE,
    booking_type TEXT,
    guest_name TEXT,
    phone_number TEXT,
    email TEXT,
    check_in_date DATE,
    check_out_date DATE,
    guest_adults INT DEFAULT 1,
    guest_children INT DEFAULT 0,
    guest_count INT DEFAULT 1,
    total_amount NUMERIC(12, 2) DEFAULT 0,
    payment_id TEXT,
    calendar_id TEXT,
    status TEXT,
    source TEXT,
    confirmation_sent BOOLEAN DEFAULT false,
    reminder_sent TEXT,
    review_requested INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_bookings_booking_type CHECK (
        booking_type IS NULL OR booking_type IN ('full_villa', 'half_villa')
    ),
    CONSTRAINT chk_bookings_status CHECK (
        status IS NULL OR status IN ('enquiry', 'cold', 'booked', 'visited', 'completed', 'cancelled')
    ),
    CONSTRAINT chk_bookings_source CHECK (
        source IS NULL OR source IN ('whatsapp', 'instagram', 'facebook', 'website', 'form')
    ),
    CONSTRAINT chk_bookings_reminder_sent CHECK (
        reminder_sent IS NULL OR reminder_sent IN ('7d', '3d', '2d', '1d', 'checkin_day')
    ),
    CONSTRAINT chk_bookings_review_requested CHECK (
        review_requested IS NULL OR (review_requested >= 0 AND review_requested <= 3)
    )
);

CREATE INDEX idx_bookings_phone_number ON public.bookings(phone_number);
CREATE INDEX idx_bookings_email ON public.bookings(email);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_check_in_date ON public.bookings(check_in_date);

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 2. CALENDAR_RULES TABLE
-- Dates that are booked or blocked, used for availability checks and website calendar
-- ----------------------------------------------------------------------------
CREATE TABLE public.calendar_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    rule_type TEXT NOT NULL,
    unit TEXT NOT NULL,
    price NUMERIC(10, 2) DEFAULT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_calendar_rules_rule_type CHECK (
        rule_type IN ('booked', 'blocked', 'available', 'custom_price')
    ),
    CONSTRAINT chk_calendar_rules_unit CHECK (
        unit IN ('full_villa', 'half_villa')
    )
);

CREATE INDEX idx_calendar_rules_booking_id ON public.calendar_rules(booking_id);
CREATE INDEX idx_calendar_rules_dates ON public.calendar_rules(start_date, end_date);

CREATE TRIGGER trg_calendar_rules_updated_at
    BEFORE UPDATE ON public.calendar_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 3. REFUNDS TABLE
-- Refunds on cancellation
-- ----------------------------------------------------------------------------
CREATE TABLE public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    refund_id TEXT,
    refund_amount NUMERIC(12, 2),
    refund_percent NUMERIC(5, 2),
    refund_reason TEXT,
    refund_status TEXT,
    processed_at TIMESTAMPTZ,
    notified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_refunds_refund_status CHECK (
        refund_status IS NULL OR refund_status IN ('pending', 'processed', 'failed')
    )
);

CREATE INDEX idx_refunds_booking_id ON public.refunds(booking_id);

CREATE TRIGGER trg_refunds_updated_at
    BEFORE UPDATE ON public.refunds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 4. REVIEWS TABLE
-- Guest reviews
-- ----------------------------------------------------------------------------
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT REFERENCES public.bookings(booking_id) ON DELETE SET NULL,
    reviewer_name TEXT,
    star_rating INT,
    review_text TEXT,
    review_date DATE,
    alert_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_reviews_star_rating CHECK (
        star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5)
    )
);

CREATE INDEX idx_reviews_booking_id ON public.reviews(booking_id);

CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 5. CHAT_SESSIONS TABLE
-- Guest's current step in an Instagram or Facebook chat booking
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    step TEXT,
    name TEXT,
    phone TEXT,
    email TEXT,
    checkin DATE,
    checkout DATE,
    guests INT,
    adults INT,
    children INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_chat_sessions_platform CHECK (
        platform IN ('instagram', 'facebook')
    ),
    CONSTRAINT uq_chat_sessions_platform_sender UNIQUE (platform, sender_id)
);

CREATE TRIGGER trg_chat_sessions_updated_at
    BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. WHATSAPP_LEADS TABLE
-- WhatsApp leads
-- ----------------------------------------------------------------------------
CREATE TABLE public.whatsapp_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL UNIQUE,
    name TEXT,
    email TEXT,
    last_message TEXT,
    enquiry_dates TEXT,
    status TEXT,
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_leads_phone_number ON public.whatsapp_leads(phone_number);

CREATE TRIGGER trg_whatsapp_leads_updated_at
    BEFORE UPDATE ON public.whatsapp_leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 7. CUSTOMERS TABLE
-- Guest profiles, used to distinguish new guests from returning ones
-- ----------------------------------------------------------------------------
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_name TEXT,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    customer_type TEXT,
    source TEXT,
    last_booking_id TEXT,
    guest_adults INT,
    guest_children INT,
    guests_count INT,
    check_in_date DATE,
    check_out_date DATE,
    total_amount NUMERIC(12, 2),
    visit_status TEXT,
    review_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_customers_customer_type CHECK (
        customer_type IS NULL OR customer_type IN ('new', 'returning')
    )
);

CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_email ON public.customers(email);

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 8. ERROR_LOGS TABLE
-- n8n Workflow error log (preserved strictly for n8n automations)
-- ----------------------------------------------------------------------------
CREATE TABLE public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow TEXT,
    error_node TEXT,
    error_type TEXT,
    error_message TEXT,
    phone_number TEXT,
    message_content TEXT,
    full_data JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_error_logs_workflow ON public.error_logs(workflow);
CREATE INDEX idx_error_logs_occurred_at ON public.error_logs(occurred_at);

CREATE TRIGGER trg_error_logs_updated_at
    BEFORE UPDATE ON public.error_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 9. APP_LOGS TABLE
-- Application general logs, event logs, and operational activity
-- ----------------------------------------------------------------------------
CREATE TABLE public.app_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL DEFAULT 'info',
    category TEXT,
    action TEXT,
    message TEXT NOT NULL,
    details JSONB,
    source TEXT DEFAULT 'server',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_app_logs_level CHECK (
        level IN ('info', 'warn', 'error', 'debug')
    )
);

CREATE INDEX idx_app_logs_level ON public.app_logs(level);
CREATE INDEX idx_app_logs_category ON public.app_logs(category);
CREATE INDEX idx_app_logs_created_at ON public.app_logs(created_at);

CREATE TRIGGER trg_app_logs_updated_at
    BEFORE UPDATE ON public.app_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 10. APP_ERROR_LOGS TABLE
-- Application error logs (distinct from n8n error_logs)
-- ----------------------------------------------------------------------------
CREATE TABLE public.app_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT,
    method TEXT,
    error_name TEXT,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    request_body JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_error_logs_endpoint ON public.app_error_logs(endpoint);
CREATE INDEX idx_app_error_logs_created_at ON public.app_error_logs(created_at);

CREATE TRIGGER trg_app_error_logs_updated_at
    BEFORE UPDATE ON public.app_error_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 11. USER_LOGS TABLE
-- User activity logs (logins, booking actions, payments, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_type TEXT DEFAULT 'guest',
    user_identifier TEXT,
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_user_logs_user_type CHECK (
        user_type IN ('guest', 'admin', 'customer', 'anonymous')
    )
);

CREATE INDEX idx_user_logs_user_identifier ON public.user_logs(user_identifier);
CREATE INDEX idx_user_logs_action ON public.user_logs(action);
CREATE INDEX idx_user_logs_created_at ON public.user_logs(created_at);

CREATE TRIGGER trg_user_logs_updated_at
    BEFORE UPDATE ON public.user_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) & SERVICE_ROLE POLICIES
-- Enable RLS on all tables and grant full access to service_role
-- ----------------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_logs ENABLE ROW LEVEL SECURITY;

-- service_role policies
DROP POLICY IF EXISTS "service_role_all_bookings" ON public.bookings;
CREATE POLICY "service_role_all_bookings" ON public.bookings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_calendar_rules" ON public.calendar_rules;
CREATE POLICY "service_role_all_calendar_rules" ON public.calendar_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_refunds" ON public.refunds;
CREATE POLICY "service_role_all_refunds" ON public.refunds FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_reviews" ON public.reviews;
CREATE POLICY "service_role_all_reviews" ON public.reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_chat_sessions" ON public.chat_sessions;
CREATE POLICY "service_role_all_chat_sessions" ON public.chat_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_whatsapp_leads" ON public.whatsapp_leads;
CREATE POLICY "service_role_all_whatsapp_leads" ON public.whatsapp_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_customers" ON public.customers;
CREATE POLICY "service_role_all_customers" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_error_logs" ON public.error_logs;
CREATE POLICY "service_role_all_error_logs" ON public.error_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_app_logs" ON public.app_logs;
CREATE POLICY "service_role_all_app_logs" ON public.app_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_app_error_logs" ON public.app_error_logs;
CREATE POLICY "service_role_all_app_error_logs" ON public.app_error_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_user_logs" ON public.user_logs;
CREATE POLICY "service_role_all_user_logs" ON public.user_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- anon policies for website/client operations
DROP POLICY IF EXISTS "anon_all_bookings" ON public.bookings;
CREATE POLICY "anon_all_bookings" ON public.bookings FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_calendar_rules" ON public.calendar_rules;
CREATE POLICY "anon_all_calendar_rules" ON public.calendar_rules FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_reviews" ON public.reviews;
CREATE POLICY "anon_all_reviews" ON public.reviews FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_app_logs" ON public.app_logs;
CREATE POLICY "anon_all_app_logs" ON public.app_logs FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_app_error_logs" ON public.app_error_logs;
CREATE POLICY "anon_all_app_error_logs" ON public.app_error_logs FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_user_logs" ON public.user_logs;
CREATE POLICY "anon_all_user_logs" ON public.user_logs FOR ALL TO anon USING (true) WITH CHECK (true);
