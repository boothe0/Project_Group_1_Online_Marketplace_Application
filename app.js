require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const setupAccounts = require('./accounts');

const app = express();
const port = process.env.PORT || 3000;
const categories = ['Books', 'Electronics', 'Furniture', 'Clothing', 'Other'];
const listingSelect = `
  SELECT listings.id, title, description, price, category, seller_id, sold, mime_type,
    users.user_id AS user,
    'data:' || mime_type || ';base64,' || replace(encode(image, 'base64'), chr(10), '') AS image
  FROM listings
  LEFT JOIN users ON listings.seller_id = users.id
`;

// use postgresql when configured. otherwise, store items until the server stops
let database;
if (process.env.DATABASE_URL)
{
  database = new Pool({ connectionString: process.env.DATABASE_URL });
}
else
{
  database = null;
}
const listings = [];
const transactionReviews = new Map();
const listingComments = new Map();
let nextListingId = 1;
let nextCommentId = 1;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// photos are sent as text, so allow a slightly larger json request
app.use(express.json({ limit: '2mb' }));
// the profile bio uses a regular html form
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));
setupAccounts(app, database, listings, transactionReviews);

// each page has its own ejs file in the views folder
app.get('/', (req, res) =>
{
  res.render('homepage');
});
app.get('/signin', (req, res) =>
{
  if (req.user)
  {
    return res.redirect('/profile');
  }
  res.render('signin');
});
app.get('/signup', (req, res) =>
{
  if (req.user)
  {
    return res.redirect('/profile');
  }
  res.render('signup');
});
app.get('/new-listing', (req, res) =>
{
  if (!req.user)
  {
    return res.redirect('/signin');
  }
  res.render('new-listing', { user: req.user });
});

// these files let us use react and jsx
app.get('/scripts/react.js', (req, res) =>
{
  res.sendFile(path.join(__dirname, 'node_modules/react/umd/react.development.js'));
});
app.get('/scripts/react-dom.js', (req, res) =>
{
  res.sendFile(path.join(__dirname, 'node_modules/react-dom/umd/react-dom.development.js'));
});
app.get('/scripts/babel.js', (req, res) =>
{
  res.sendFile(require.resolve('@babel/standalone/babel.min.js'));
});

function ownsListing(user, listing)
{
  return Boolean(user && listing.seller_id === user.id);
}

function listingResponse(user, listing)
{
  const result = { ...listing, canEdit: ownsListing(user, listing) };
  delete result.buyer_id;
  return result;
}

function readPrice(value)
{
  if (value === undefined || value === '')
  {
    return null;
  }
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value))
  {
    return NaN;
  }
  return Number(value);
}

// filter by one or more categories and optional inclusive price bounds
app.get('/api/listings', async (req, res) =>
{
  const selectedCategories = [req.query.category || []].flat();
  if (selectedCategories.some((category) => !categories.includes(category)))
  {
    return res.status(400).json({ error: 'Choose categories from the list.' });
  }

  const minPrice = readPrice(req.query.minPrice);
  const maxPrice = readPrice(req.query.maxPrice);
  if ((minPrice !== null && !Number.isFinite(minPrice)) ||
      (maxPrice !== null && !Number.isFinite(maxPrice)) ||
      (minPrice !== null && maxPrice !== null && minPrice > maxPrice))
  {
    return res.status(400).json({ error: 'Enter a valid minimum and maximum price.' });
  }

  const activeOnly = req.query.active === 'true';
  try
  {
    let results;
    if (database)
    {
      const result = await database.query(`
        ${listingSelect}
        WHERE ($1::text[] IS NULL OR listings.category = ANY($1::text[]))
          AND ($2::numeric IS NULL OR listings.price >= $2)
          AND ($3::numeric IS NULL OR listings.price <= $3)
          AND (NOT $4::boolean OR NOT listings.sold)
        ORDER BY listings.id DESC
      `, [selectedCategories.length ? selectedCategories : null, minPrice, maxPrice, activeOnly]);
      results = result.rows;
    }
    else
    {
      results = listings.filter((listing) =>
        (selectedCategories.length === 0 || selectedCategories.includes(listing.category)) &&
        (minPrice === null || listing.price >= minPrice) &&
        (maxPrice === null || listing.price <= maxPrice) &&
        (!activeOnly || !listing.sold)
      );
    }
    res.set('Cache-Control', 'no-store');
    res.json(results.map((listing) => listingResponse(req.user, listing)));
  }
  catch (error)
  {
    console.error(error);
    res.status(500).json({ error: 'Could not load listings. Check your database connection.' });
  }
});

// check the same form fields when creating or updating a listing
function validateListing(req, res, next)
{
  const { title, description, price, category, image } = req.body || {};

  const titleIsValid = typeof title === 'string' && title.trim() !== '' && title.length <= 100;
  const descriptionIsValid = typeof description === 'string' && description.trim() !== '' && description.length <= 2000;
  if (!titleIsValid || !descriptionIsValid)
  {
    return res.status(400).json({ error: 'Enter a title and description within the form limits.' });
  }
  let priceIsValid = false;
  if (typeof price === 'string' || typeof price === 'number')
  {
    const amount = Number(price);
    priceIsValid = String(price).trim() !== '' && Number.isFinite(amount) && amount >= 0 && amount <= 999999.99;
  }
  if (!priceIsValid)
  {
    return res.status(400).json({ error: 'Enter a price between 0 and 999999.99.' });
  }
  if (!categories.includes(category))
  {
    return res.status(400).json({ error: 'Choose a category from the list.' });
  }
  if (req.method === 'PUT' && image === undefined)
  {
    return next();
  }

  // filereader sends the photo as a data url containing base64 text
  let photo;
  if (typeof image === 'string')
  {
    photo = image.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  }
  else
  {
    photo = null;
  }
  if (!photo)
  {
    return res.status(400).json({ error: 'Choose a JPG, PNG, or WebP photo.' });
  }
  const photoBytes = Buffer.from(photo[2], 'base64');
  if (photoBytes.length === 0 || photoBytes.toString('base64') !== photo[2])
  {
    return res.status(400).json({ error: 'Could not read the photo. Please choose another one.' });
  }
  if (photoBytes.length > 1024 * 1024)
  {
    return res.status(400).json({ error: 'Choose a photo that is 1 MB or smaller.' });
  }

  const mimeType = `image/${photo[1]}`;

  req.photoBytes = photoBytes;
  req.mimeType = mimeType;

  next();
}

// check listing ids before using them in a database query
app.param('id', (req, res, next, id) =>
{
  const listingId = Number(id);
  if (!/^\d+$/.test(id) || listingId < 1 || listingId > 2147483647)
  {
    return res.status(400).json({ error: 'Invalid listing ID.' });
  }
  req.listingId = listingId;
  next();
});

app.get('/listings/:id/comments', (req, res) =>
{
  res.render('comments', { listingId: req.listingId });
});

// get listing to fill in the update form
app.get('/api/listings/:id', async (req, res) =>
{
  try
  {
    let listing;
    if (database)
    {
      const result = await database.query(
        `${listingSelect} WHERE listings.id = $1`,
        [req.listingId]
      );
      listing = result.rows[0];
    }
    else
    {
      listing = listings.find((item) => item.id === req.listingId);
    }
    if (!listing)
    {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    res.set('Cache-Control', 'no-store');
    res.json(listingResponse(req.user, listing));
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not load the listing.' });
  }
});

app.get('/api/listings/:id/comments', async (req, res) =>
{
  try
  {
    let listing;
    let comments;
    if (database)
    {
      const result = await database.query(
        'SELECT id, title FROM listings WHERE id = $1',
        [req.listingId]
      );
      listing = result.rows[0];
      if (listing)
      {
        const discussion = await database.query(`
          SELECT comments.id, users.user_id AS author, comments.text, created_at AS "createdAt"
          FROM comments
          JOIN users ON users.id = comments.author_id
          WHERE comments.listing_id = $1
          ORDER BY comments.id
        `, [req.listingId]);
        comments = discussion.rows;
      }
    }
    else
    {
      listing = listings.find((item) => item.id === req.listingId);
      comments = listingComments.get(req.listingId) || [];
    }
    if (!listing)
    {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      listing: { id: listing.id, title: listing.title },
      comments,
      canComment: Boolean(req.user)
    });
  }
  catch (error)
  {
    console.error(error);
    res.status(500).json({ error: 'Could not load comments for this listing.' });
  }
});

app.post('/api/listings/:id/comments', async (req, res) =>
{
  if (!req.user)
  {
    return res.status(401).json({ error: 'Sign in to post a comment.' });
  }
  const { text } = req.body || {};
  if (typeof text !== 'string' || text.trim() === '' || text.trim().length > 2000)
  {
    return res.status(400).json({ error: 'Enter a comment up to 2000 characters.' });
  }

  try
  {
    if (database)
    {
      const result = await database.query(`
        INSERT INTO comments (listing_id, author_id, text)
        SELECT id, $2::integer, $3 FROM listings WHERE id = $1
        RETURNING id, text, created_at AS "createdAt"
      `, [req.listingId, req.user.id, text.trim()]);
      if (!result.rowCount)
      {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      return res.status(201).json({ comment: { ...result.rows[0], author: req.user.user_id } });
    }

    if (!listings.some((item) => item.id === req.listingId))
    {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const comment = {
      id: nextCommentId++,
      author: req.user.user_id,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };
    const comments = listingComments.get(req.listingId) || [];
    comments.push(comment);
    listingComments.set(req.listingId, comments);
    res.status(201).json({ comment });
  }
  catch (error)
  {
    if (error.code === '23503')
    {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Could not post your comment.' });
  }
});

// save new listing
app.post('/api/listings', (req, res, next) =>
{
  if (!req.user)
  {
    return res.status(401).json({ error: 'Sign in before creating a listing.' });
  }
  next();
}, validateListing, async (req, res) =>
{
  const { title, description, price, category, image } = req.body;
  const { photoBytes, mimeType } = req;
  try
  {
    if (database)
    {
      const result = await database.query(
        `INSERT INTO listings
        (title, description, price, category, image, mime_type, seller_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [title.trim(), description.trim(), price, category, photoBytes, mimeType, req.user.id]
      );
      const listing = { ...result.rows[0], user: req.user.user_id };
      return res.status(201).json(listingResponse(req.user, listing));
    }
    const listing = { id: nextListingId++, title: title.trim(), description: description.trim(), price: Number(Number(price).toFixed(2)), category, image, sold: false, user: req.user.user_id, seller_id: req.user.id };
    listings.unshift(listing);
    res.status(201).json(listingResponse(req.user, listing));
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not save the listing. Please try again.' });
  }
});

async function requireListingOwner(req, res, next)
{
  if (!req.user)
  {
    return res.status(401).json({ error: 'Sign in to manage a listing.' });
  }

  try
  {
    let listing;
    if (database)
    {
      const result = await database.query(
        'SELECT seller_id FROM listings WHERE id = $1',
        [req.listingId]
      );
      listing = result.rows[0];
    }
    else
    {
      listing = listings.find((item) => item.id === req.listingId);
    }
    if (!listing)
    {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    if (!ownsListing(req.user, listing))
    {
      return res.status(403).json({ error: 'Only the seller can manage this listing.' });
    }
    next();
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not check who owns the listing.' });
  }
}

// update the fields, keeping the owner and any existing photo
app.put('/api/listings/:id', requireListingOwner, validateListing, async (req, res) =>
{
  const { title, description, price, category, image } = req.body;
  try
  {
    let listing;
    if (database)
    {
      const result = await database.query(
        `UPDATE listings
         SET title = $1,
             description = $2,
             price = $3,
             category = $4,
             image = COALESCE($5, image),
             mime_type = COALESCE($6, mime_type)
         WHERE id = $7 AND seller_id = $8
         RETURNING id, title, description, price, category, seller_id, sold, mime_type, image`,
        [
          title.trim(),
          description.trim(),
          price,
          category,
          req.photoBytes,
          req.mimeType,
          req.listingId,
          req.user.id
        ]
      );
      listing = result.rows[0];
    }
    else
    {
      listing = listings.find((item) => item.id === req.listingId && ownsListing(req.user, item));
      if (listing)
      {
        listing.title = title.trim();
        listing.description = description.trim();
        listing.price = Number(Number(price).toFixed(2));
        listing.category = category;
        if (image !== undefined)
        {
          listing.image = image;
        }
      }
    }
    if (!listing)
    {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    res.json(listingResponse(req.user, listing));
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not update the listing.' });
  }
});

// record the signed-in buyer when the item is marked as sold
app.post('/api/listings/:id/buy', async (req, res) =>
{
  if (!req.user)
  {
    return res.status(401).json({ error: 'Sign in before buying a listing.' });
  }

  try
  {
    let listing;
    if (database)
    {
      const result = await database.query(
        `UPDATE listings SET sold = TRUE, buyer_id = $2
         WHERE id = $1 AND sold = FALSE
         RETURNING id, title, sold`,
        [req.listingId, req.user.id]
      );
      listing = result.rows[0];
      if (!listing)
      {
        return res.status(409).json({ error: 'This listing is no longer available.' });
      }
    }
    else
    {
      listing = listings.find((item) => item.id === req.listingId);
      if (!listing)
      {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (listing.sold)
      {
        return res.status(409).json({ error: 'This item is already sold.' });
      }
      listing.sold = true;
      listing.buyer_id = req.user.id;
    }
    res.json({ id: listing.id, title: listing.title, sold: listing.sold });
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not mark the item as sold. Check that your database table is up to date.' });
  }
});

app.get('/api/transactions/:id/review', async (req, res) =>
{
  try
  {
    let review;
    if (database)
    {
      const result = await database.query(`
        SELECT listing_id AS "transactionId", rating::float8, feedback
        FROM reviews
        WHERE listing_id = $1
      `, [req.listingId]);
      review = result.rows[0];
    }
    else
    {
      review = transactionReviews.get(req.listingId);
    }
    if (!review)
    {
      return res.status(404).json({ error: 'No review found for this transaction.' });
    }
    res.json({ review });
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not load the review.' });
  }
});

// the buyer can submit one review for a sold listing
app.post('/api/transactions/:id/review', async (req, res) =>
{
  if (!req.user)
  {
    return res.status(401).json({ error: 'Sign in to submit a review.' });
  }
  const { rating, feedback } = req.body || {};
  const numericRating = Number(rating);
  if ((typeof rating !== 'number' && typeof rating !== 'string') ||
      numericRating < 0.5 || numericRating > 5 || !Number.isInteger(numericRating * 2))
  {
    return res.status(400).json({ error: 'Choose a rating from 0.5 to 5 stars in half-star increments.' });
  }
  if (typeof feedback !== 'string' || feedback.trim() === '' || feedback.trim().length > 1000)
  {
    return res.status(400).json({ error: 'Enter feedback up to 1000 characters.' });
  }
  try
  {
    let listing;
    if (database)
    {
      const result = await database.query(
        'SELECT sold, buyer_id FROM listings WHERE id = $1',
        [req.listingId]
      );
      listing = result.rows[0];
    }
    else
    {
      listing = listings.find((item) => item.id === req.listingId);
    }
    if (!listing)
    {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    if (!listing.sold)
    {
      return res.status(409).json({ error: 'A review can only be submitted after the item is sold.' });
    }
    if (listing.buyer_id !== req.user.id)
    {
      return res.status(403).json({ error: 'Only the buyer can review this transaction.' });
    }

    const review = {
      transactionId: req.listingId,
      rating: numericRating,
      feedback: feedback.trim()
    };
    if (database)
    {
      const result = await database.query(`
        INSERT INTO reviews (listing_id, reviewer_id, rating, feedback)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (listing_id) DO NOTHING
      `, [req.listingId, req.user.id, review.rating, review.feedback]);
      if (!result.rowCount)
      {
        return res.status(409).json({ error: 'A review has already been submitted for this transaction.' });
      }
    }
    else
    {
      if (transactionReviews.has(req.listingId))
      {
        return res.status(409).json({ error: 'A review has already been submitted for this transaction.' });
      }
      transactionReviews.set(req.listingId, review);
    }
    res.status(201).json({ message: 'Review submitted.', review });
  }
  catch (error)
  {
    if (error.code === '23503')
    {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    res.status(500).json({ error: 'Could not submit the review.' });
  }
});

// delete a listing permanently
app.delete('/api/listings/:id', requireListingOwner, async (req, res) =>
{
  try
  {
    if (database)
    {
      const result = await database.query(
        'DELETE FROM listings WHERE id = $1 AND seller_id = $2',
        [req.listingId, req.user.id]
      );
      if (result.rowCount === 0)
      {
        return res.status(404).json({ error: 'Listing not found.' });
      }
    }
    else
    {
      const index = listings.findIndex((item) => item.id === req.listingId && ownsListing(req.user, item));
      if (index === -1)
      {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      listings.splice(index, 1);
      listingComments.delete(req.listingId);
      transactionReviews.delete(req.listingId);
    }
    res.json({ message: 'Listing deleted.' });
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not delete the listing.' });
  }
});

app.use((error, req, res, next) =>
{
  if (error.type === 'entity.too.large')
  {
    return res.status(413).json({ error: 'Photo is too large. Choose a photo that is 1 MB or smaller.' });
  }
  next(error);
});

app.listen(port, () =>
{
  console.log(`NAU Market: http://localhost:${port}`);
  if (!database)
  {
    console.log('No database connected. Data resets when the server stops.');
  }
});
