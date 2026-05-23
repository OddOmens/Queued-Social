-- Add default templates for new users
-- This migration creates a function to insert default templates when a user profile is created

-- Function to create default templates for a user
CREATE OR REPLACE FUNCTION create_default_templates(user_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Insert default templates
  INSERT INTO templates (user_id, name, content, platform, category) VALUES
  (
    user_uuid,
    'Motivational Monday',
    '{
      "type": "single",
      "text": "🌟 Monday Motivation 🌟\n\nNew week, new opportunities! What''s one goal you''re excited to work on this week?\n\nDrop it in the comments and let''s cheer each other on! 👇\n\n#MondayMotivation #Goals #NewWeek #Productivity",
      "metadata": {
        "replySettings": "everyone",
        "allowReplies": true
      }
    }'::jsonb,
    'threads',
    'Engagement'
  ),
  (
    user_uuid,
    'Behind the Scenes',
    '{
      "type": "single",
      "text": "Behind the scenes moment ✨\n\n[Share what you''re working on, your workspace, or a candid moment]\n\nI love showing the real side of what I do. What''s happening behind the scenes in your world today?\n\n#BehindTheScenes #RealLife #Authentic #WorkInProgress",
      "metadata": {
        "replySettings": "everyone",
        "allowReplies": true
      }
    }'::jsonb,
    'threads',
    'Authentic'
  ),
  (
    user_uuid,
    'Engagement Question Thread',
    '{
      "type": "thread",
      "text": "Let''s start a conversation! 💬\n\nI''m curious about your experiences...",
      "threadPosts": [
        "What''s the best piece of advice you''ve ever received?",
        "How has it changed your perspective or approach to life?",
        "Share your story below - I''d love to read them! 👇"
      ],
      "metadata": {
        "replySettings": "everyone",
        "allowReplies": true
      }
    }'::jsonb,
    'threads',
    'Engagement'
  ),
  (
    user_uuid,
    'Quick Tip Tuesday',
    '{
      "type": "single",
      "text": "💡 Quick Tip Tuesday 💡\n\n[Insert your valuable tip here]\n\nThis simple trick has saved me so much time! Have you tried this before? What are your go-to productivity hacks?\n\n#TipTuesday #Productivity #LifeHacks #Tips",
      "metadata": {
        "replySettings": "everyone",
        "allowReplies": true
      }
    }'::jsonb,
    'threads',
    'Educational'
  ),
  (
    user_uuid,
    'Gratitude & Appreciation',
    '{
      "type": "single",
      "text": "Gratitude check ✨\n\nToday I''m grateful for:\n• [Something specific]\n• [Someone in your life]\n• [A recent experience]\n\nWhat are you grateful for today? Let''s spread some positivity! 🙏\n\n#Gratitude #Thankful #Positivity #Blessed",
      "metadata": {
        "replySettings": "everyone",
        "allowReplies": true
      }
    }'::jsonb,
    'threads',
    'Positive'
  ),
  (
    user_uuid,
    'Weekend Reflection',
    '{
      "type": "thread",
      "text": "Weekend reflection time 🌅\n\nLooking back at this week...",
      "threadPosts": [
        "✅ One thing I accomplished that I''m proud of",
        "📚 One thing I learned",
        "🎯 One thing I want to focus on next week",
        "What about you? Share your weekly wins and lessons! 👇"
      ],
      "metadata": {
        "replySettings": "everyone",
        "allowReplies": true
      }
    }'::jsonb,
    'threads',
    'Reflective'
  );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to automatically create default templates for new users
CREATE OR REPLACE FUNCTION trigger_create_default_templates()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default templates for the new user
  PERFORM create_default_templates(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run after user profile is created
CREATE TRIGGER after_user_profile_created
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_templates();

-- Add comment for documentation
COMMENT ON FUNCTION create_default_templates(UUID) IS 'Creates default templates for a new user';
COMMENT ON FUNCTION trigger_create_default_templates() IS 'Trigger function to automatically create default templates when a user profile is created';