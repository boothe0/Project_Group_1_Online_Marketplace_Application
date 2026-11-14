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

CREATE TABLE IF NOT EXISTS listings (
	id SERIAL PRIMARY KEY,
	title VARCHAR(50) NOT NULL,
	description TEXT NOT NULL,
	price DECIMAL (10, 2) NOT NULL,
	category VARCHAR(50) NOT NULL,
  mime_type VARCHAR(50),
	image BYTEA
);

