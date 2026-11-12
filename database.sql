-- run file inside database
-- users choose a unique user id when signing up
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(128) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  bio TEXT NOT NULL DEFAULT ''
);
