-- Run this in your Supabase SQL Editor to add the missing columns

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS longitude double precision;

-- Optional: Add an index for geospatial queries if you plan to use PostGIS later
-- CREATE INDEX ON incidents USING gist (ST_MakePoint(longitude, latitude));
