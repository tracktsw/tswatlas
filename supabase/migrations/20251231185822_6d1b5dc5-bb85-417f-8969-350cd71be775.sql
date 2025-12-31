-- Add skin_intensity column for new intensity scale
-- Scale: 4=High-intensity, 3=Active, 2=Noticeable, 1=Settling, 0=Calm
ALTER TABLE user_check_ins 
ADD COLUMN skin_intensity integer;

COMMENT ON COLUMN user_check_ins.skin_intensity IS 
'Skin intensity scale: 4=High-intensity, 3=Active, 2=Noticeable, 1=Settling, 0=Calm';