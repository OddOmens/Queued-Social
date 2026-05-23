-- Recurring Posts Migration
-- Creates tables for managing recurring post schedules

-- Recurring posts configuration table
CREATE TABLE recurring_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  days_of_week INTEGER[] NOT NULL CHECK (array_length(days_of_week, 1) > 0),
  time_range_start TIME NOT NULL,
  time_range_end TIME NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_posted_at TIMESTAMP WITH TIME ZONE,
  next_post_date TIMESTAMP WITH TIME ZONE
);

-- Recurring post execution history
CREATE TABLE recurring_post_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recurring_post_id UUID REFERENCES recurring_posts(id) ON DELETE CASCADE NOT NULL,
  scheduled_post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL,
  execution_date DATE NOT NULL,
  execution_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'published', 'failed', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_recurring_posts_user_active ON recurring_posts(user_id, is_active);
CREATE INDEX idx_recurring_posts_next_post_date ON recurring_posts(next_post_date) WHERE is_active = true;
CREATE INDEX idx_recurring_post_executions_recurring_post ON recurring_post_executions(recurring_post_id);
CREATE INDEX idx_recurring_post_executions_date ON recurring_post_executions(execution_date);

-- Add updated_at trigger
CREATE TRIGGER update_recurring_posts_updated_at 
    BEFORE UPDATE ON recurring_posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for recurring_posts
ALTER TABLE recurring_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring posts" ON recurring_posts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring posts" ON recurring_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring posts" ON recurring_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring posts" ON recurring_posts
    FOR DELETE USING (auth.uid() = user_id);

-- Service role policies for system operations
CREATE POLICY "Service role can read recurring posts for processing" ON recurring_posts
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'service_role' OR 
        auth.uid() = user_id
    );

CREATE POLICY "Service role can update recurring posts" ON recurring_posts
    FOR UPDATE USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- RLS Policies for recurring_post_executions
ALTER TABLE recurring_post_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring post executions" ON recurring_post_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM recurring_posts 
            WHERE id = recurring_post_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own recurring post executions" ON recurring_post_executions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM recurring_posts 
            WHERE id = recurring_post_id AND user_id = auth.uid()
        )
    );

-- Service role policies for executions
CREATE POLICY "Service role can manage recurring post executions" ON recurring_post_executions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to calculate next post date for a recurring post
CREATE OR REPLACE FUNCTION calculate_next_post_date(
    p_days_of_week INTEGER[],
    p_time_range_start TIME,
    p_time_range_end TIME,
    p_timezone VARCHAR(50) DEFAULT 'UTC',
    p_last_posted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
DECLARE
    current_date_tz TIMESTAMP WITH TIME ZONE;
    check_date DATE;
    day_of_week INTEGER;
    random_time TIME;
    next_post_timestamp TIMESTAMP WITH TIME ZONE;
    days_to_check INTEGER := 14; -- Check up to 2 weeks ahead
BEGIN
    -- Get current time in the specified timezone
    current_date_tz := NOW() AT TIME ZONE p_timezone;
    
    -- Start checking from today (or day after last post if it was today)
    IF p_last_posted_at IS NOT NULL AND DATE(p_last_posted_at AT TIME ZONE p_timezone) = DATE(current_date_tz) THEN
        check_date := DATE(current_date_tz) + INTERVAL '1 day';
    ELSE
        check_date := DATE(current_date_tz);
    END IF;
    
    -- Look for the next valid day within the next 2 weeks
    FOR i IN 0..days_to_check LOOP
        day_of_week := EXTRACT(DOW FROM check_date + i);
        
        -- Check if this day is in our target days
        IF day_of_week = ANY(p_days_of_week) THEN
            -- Generate random time within the specified range
            random_time := p_time_range_start + (
                RANDOM() * (
                    EXTRACT(EPOCH FROM p_time_range_end) - 
                    EXTRACT(EPOCH FROM p_time_range_start)
                )
            ) * INTERVAL '1 second';
            
            -- Create the full timestamp
            next_post_timestamp := (check_date + i)::TIMESTAMP + random_time;
            
            -- Convert to the specified timezone
            next_post_timestamp := next_post_timestamp AT TIME ZONE p_timezone;
            
            -- Make sure it's in the future
            IF next_post_timestamp > NOW() THEN
                RETURN next_post_timestamp;
            END IF;
        END IF;
    END LOOP;
    
    -- If no valid date found, return NULL
    RETURN NULL;
END;
$$;

-- Function to update next_post_date when recurring post is modified
CREATE OR REPLACE FUNCTION update_recurring_post_next_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only update next_post_date if the post is active and relevant fields changed
    IF NEW.is_active = true AND (
        OLD.days_of_week IS DISTINCT FROM NEW.days_of_week OR
        OLD.time_range_start IS DISTINCT FROM NEW.time_range_start OR
        OLD.time_range_end IS DISTINCT FROM NEW.time_range_end OR
        OLD.timezone IS DISTINCT FROM NEW.timezone OR
        OLD.is_active IS DISTINCT FROM NEW.is_active OR
        OLD.last_posted_at IS DISTINCT FROM NEW.last_posted_at
    ) THEN
        NEW.next_post_date := calculate_next_post_date(
            NEW.days_of_week,
            NEW.time_range_start,
            NEW.time_range_end,
            NEW.timezone,
            NEW.last_posted_at
        );
    ELSIF NEW.is_active = false THEN
        NEW.next_post_date := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Add trigger to automatically update next_post_date
CREATE TRIGGER update_recurring_post_next_date_trigger
    BEFORE INSERT OR UPDATE ON recurring_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_recurring_post_next_date();

-- Function to process recurring posts (called by cron job)
CREATE OR REPLACE FUNCTION process_recurring_posts()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    recurring_post_record RECORD;
    new_scheduled_post_id UUID;
    execution_time TIME;
BEGIN
    -- Find recurring posts that should be posted now
    FOR recurring_post_record IN 
        SELECT * FROM recurring_posts 
        WHERE is_active = true 
        AND next_post_date IS NOT NULL
        AND next_post_date <= NOW()
        ORDER BY next_post_date
    LOOP
        BEGIN
            -- Extract the time component for the execution record
            execution_time := (recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone)::TIME;
            
            -- Create a new scheduled post
            INSERT INTO scheduled_posts (
                user_id,
                platform,
                content,
                scheduled_time,
                status
            ) VALUES (
                recurring_post_record.user_id,
                recurring_post_record.platform,
                recurring_post_record.content,
                recurring_post_record.next_post_date,
                'scheduled'
            ) RETURNING id INTO new_scheduled_post_id;
            
            -- Record the execution
            INSERT INTO recurring_post_executions (
                recurring_post_id,
                scheduled_post_id,
                execution_date,
                execution_time,
                status
            ) VALUES (
                recurring_post_record.id,
                new_scheduled_post_id,
                DATE(recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone),
                execution_time,
                'scheduled'
            );
            
            -- Update the recurring post with last_posted_at and calculate next_post_date
            UPDATE recurring_posts 
            SET 
                last_posted_at = recurring_post_record.next_post_date,
                next_post_date = calculate_next_post_date(
                    days_of_week,
                    time_range_start,
                    time_range_end,
                    timezone,
                    recurring_post_record.next_post_date
                )
            WHERE id = recurring_post_record.id;
            
            RAISE NOTICE 'Created scheduled post % for recurring post %', new_scheduled_post_id, recurring_post_record.id;
            
        EXCEPTION WHEN OTHERS THEN
            -- Record the failed execution
            INSERT INTO recurring_post_executions (
                recurring_post_id,
                execution_date,
                execution_time,
                status,
                error_message
            ) VALUES (
                recurring_post_record.id,
                DATE(recurring_post_record.next_post_date AT TIME ZONE recurring_post_record.timezone),
                execution_time,
                'failed',
                SQLERRM
            );
            
            -- Still update next_post_date so we don't get stuck
            UPDATE recurring_posts 
            SET next_post_date = calculate_next_post_date(
                days_of_week,
                time_range_start,
                time_range_end,
                timezone,
                next_post_date
            )
            WHERE id = recurring_post_record.id;
            
            RAISE NOTICE 'Failed to create scheduled post for recurring post %: %', recurring_post_record.id, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- Update the main cron job to also process recurring posts
CREATE OR REPLACE FUNCTION process_scheduled_posts()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    post_record RECORD;
    response_status INTEGER;
    response_body TEXT;
    request_body TEXT;
    edge_function_url TEXT;
BEGIN
    -- First, process recurring posts
    PERFORM process_recurring_posts();
    
    -- Then process regular scheduled posts (existing logic)
    edge_function_url := current_setting('app.edge_function_url', true);
    
    IF edge_function_url IS NOT NULL AND edge_function_url != '' THEN
        -- Build request body with posts to process
        SELECT json_agg(
            json_build_object(
                'id', id,
                'userId', user_id,
                'platform', platform,
                'content', content,
                'scheduledTime', scheduled_time
            )
        )::text INTO request_body
        FROM scheduled_posts 
        WHERE status = 'scheduled' 
        AND scheduled_time <= NOW()
        LIMIT 10;
        
        IF request_body IS NOT NULL AND request_body != 'null' THEN
            -- Make HTTP request to Edge Function
            SELECT status, content INTO response_status, response_body
            FROM http_post(
                edge_function_url,
                request_body,
                'application/json'
            );
            
            RAISE NOTICE 'Edge function response: % - %', response_status, response_body;
        END IF;
    ELSE
        -- Fallback: Just log what we would process
        RAISE NOTICE 'Fallback: Found % scheduled posts to process', (
            SELECT COUNT(*) FROM scheduled_posts 
            WHERE status = 'scheduled' 
            AND scheduled_time <= NOW()
        );
        
        -- Log some details about the posts
        FOR post_record IN 
            SELECT id, scheduled_time 
            FROM scheduled_posts 
            WHERE status = 'scheduled'
            ORDER BY scheduled_time DESC
            LIMIT 5
        LOOP
            RAISE NOTICE 'Post % scheduled for %', post_record.id, post_record.scheduled_time;
        END LOOP;
    END IF;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE recurring_posts IS 'Stores recurring post configurations that automatically create scheduled posts';
COMMENT ON TABLE recurring_post_executions IS 'Tracks execution history of recurring posts';
COMMENT ON FUNCTION calculate_next_post_date IS 'Calculates the next random post time within specified constraints';
COMMENT ON FUNCTION process_recurring_posts IS 'Processes recurring posts and creates scheduled posts';