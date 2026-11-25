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
  title VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  mime_type VARCHAR(50),
  image BYTEA
);

-- apply changes to existing databases too
ALTER TABLE listings
  ALTER COLUMN title TYPE VARCHAR(100),
  ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS sold BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS buyer_id INTEGER REFERENCES users(id);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  text VARCHAR(2000) NOT NULL CHECK (length(btrim(text)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS comments_listing_id_idx ON comments (listing_id);

-- each listing can be sold once, so its id identifies the transaction
CREATE TABLE IF NOT EXISTS reviews (
  listing_id INTEGER PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  rating NUMERIC NOT NULL CHECK (rating BETWEEN 0.5 AND 5 AND mod(rating * 2, 1) = 0),
  feedback VARCHAR(1000) NOT NULL CHECK (length(btrim(feedback)) > 0)
);
