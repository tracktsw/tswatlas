-- Add language preference column to user_settings
ALTER TABLE user_settings 
ADD COLUMN language TEXT DEFAULT 'en';