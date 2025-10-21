-- Add real happy hour establishments in New York area
-- You can find real establishments and their coordinates using Google Maps or other sources

INSERT INTO happy_hours (name, address, start_time, end_time, location, description) VALUES
('The Dead Rabbit', '30 Water St, New York, NY 10004', '15:00', '19:00', ST_MakePoint(-74.0134, 40.7037), '$5 cocktails, $3 beer'),
('Stone Street Tavern', '52 Stone St, New York, NY 10004', '16:00', '20:00', ST_MakePoint(-74.0128, 40.7042), 'Half price drinks, free appetizers'),
('Jeremy''s Ale House', '228 Front St, New York, NY 10038', '11:00', '19:00', ST_MakePoint(-74.0065, 40.7069), '$2 beer, $4 wine'),
('The Fulton', '89 South St, New York, NY 10038', '17:00', '19:00', ST_MakePoint(-74.0032, 40.7065), 'Buy one get one cocktails'),
('Fraunces Tavern', '54 Pearl St, New York, NY 10004', '16:00', '18:00', ST_MakePoint(-74.0116, 40.7038), 'Historic tavern, $6 drafts'),

-- Add some in Midtown area
('The Campbell', '15 Vanderbilt Ave, New York, NY 10017', '17:00', '19:00', ST_MakePoint(-73.9772, 40.7527), 'Grand Central happy hour'),
('O''Hara''s Restaurant and Pub', '120 Cedar St, New York, NY 10006', '16:00', '19:00', ST_MakePoint(-74.0088, 40.7071), '$4 beer, $6 cocktails'),
('The Press Lounge', '653 11th Ave, New York, NY 10036', '17:00', '19:00', ST_MakePoint(-73.9968, 40.7614), 'Rooftop views, premium drinks'),

-- Add some in Brooklyn (for testing other postal codes)
('Brooklyn Bridge Garden Bar', '1 Water St, Brooklyn, NY 11201', '16:00', '20:00', ST_MakePoint(-73.9969, 40.7022), 'Waterfront views, $5 cocktails'),
('Cecconi''s', '55 Water St, Brooklyn, NY 11201', '15:00', '18:00', ST_MakePoint(-73.9958, 40.7020), 'Italian-inspired happy hour');