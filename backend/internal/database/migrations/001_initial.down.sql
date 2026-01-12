-- Drop triggers
DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse order of creation due to foreign keys)
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS magic_links;
DROP TABLE IF EXISTS users;

-- Drop extension
DROP EXTENSION IF EXISTS "uuid-ossp";
