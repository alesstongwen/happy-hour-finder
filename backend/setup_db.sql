-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create happy_hours table
CREATE TABLE IF NOT EXISTS happy_hours (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    benefits TEXT[] NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL
);

-- Insert some sample data for testing
INSERT INTO happy_hours (name, benefits, start_time, end_time, location) VALUES
('The Local Pub', ARRAY['50% off drinks', 'Free appetizers'], '15:00', '18:00', ST_MakePoint(-73.986, 40.748)),
('Sunset Bar', ARRAY['$5 cocktails', 'Buy one get one beer'], '16:00', '19:00', ST_MakePoint(-73.985, 40.747)),
('City Tavern', ARRAY['Happy hour specials', '25% off wine'], '17:00', '20:00', ST_MakePoint(-73.987, 40.749));