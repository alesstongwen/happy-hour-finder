-- Add more sample data with extended happy hour times for testing
INSERT INTO happy_hours (name, benefits, start_time, end_time, location) VALUES
('Early Bird Bar', ARRAY['Morning specials', '$3 coffee drinks'], '08:00', '11:00', ST_MakePoint(-73.988, 40.750)),
('Lunch Hour Lounge', ARRAY['Lunch specials', '$4 beer'], '11:00', '14:00', ST_MakePoint(-73.984, 40.746)),
('All Day Happy', ARRAY['All day discounts', '$6 cocktails'], '12:00', '23:00', ST_MakePoint(-73.989, 40.745)),
('Late Night Spot', ARRAY['Night owl specials', 'Half price shots'], '21:00', '02:00', ST_MakePoint(-73.983, 40.751)),
('Weekend Warrior', ARRAY['Weekend deals', '$5 pitchers'], '14:00', '17:00', ST_MakePoint(-73.990, 40.752));