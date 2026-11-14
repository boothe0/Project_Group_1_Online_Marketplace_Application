require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const setupAccounts = require('./accounts');

const app = express();
const port = process.env.PORT || 3000;
const categories = ['Books', 'Electronics', 'Furniture', 'Clothing', 'Other'];

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
let nextListingId = 1;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// photos are sent as text, so allow a slightly larger json request
app.use(express.json({ limit: '2mb' }));
// the profile bio uses a regular html form
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));
setupAccounts(app, database);

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
  res.render('new-listing');
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

// get all listings for the homepage
// get all listings for the homepage
app.get('/api/listings', async (req, res) =>
{
    try
    {
        if (database)
        {
            const result = await database.query(`
                SELECT *,
                    CASE
                        WHEN image IS NOT NULL
                        THEN 'data:' || mime_type || ';base64,' ||
                             encode(image, 'base64')
                        ELSE NULL
                    END AS image_data
                FROM listings
                ORDER BY id DESC
            `);

            return res.json(result.rows.map((item) => ({
                ...item,
                image: item.image_data
            })));
        }

        res.json(listings);
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({
            error: 'Could not load listings. Check your database connection.'
        });
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
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1)
  {
    return res.status(400).json({ error: 'Invalid listing ID.' });
  }
  next();
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
        `SELECT *,
            CASE
                WHEN image IS NOT NULL
                THEN 'data:' || mime_type || ';base64,' ||
                    encode(image, 'base64')
                ELSE NULL
            END AS image_data
        FROM listings
        WHERE id = $1`,
        [req.params.id]
    );

    listing = result.rows[0];

    if (listing)
    {
        listing.image = listing.image_data;
        delete listing.image_data;
    }
    }
    else
    {
      listing = listings.find((item) => item.id === Number(req.params.id));
    }
    if (!listing)
    {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    res.json(listing);
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not load the listing.' });
  }
});

// save new listing
app.post('/api/listings', validateListing, async (req, res) =>
{
  const { title, description, price, category, image } = req.body;
  const {photoBytes, mimeType} = req;
  try
  {
    if (database)
    {
      const result = await database.query(
        `INSERT INTO listings
        (title, description, price, category, image, mime_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [title.trim(), description.trim(), price, category, photoBytes, mimeType]
      );
      return res.status(201).json(result.rows[0]);
    }
    const listing = { id: nextListingId++, title: title.trim(), description: description.trim(), price: Number(Number(price).toFixed(2)), category, image, sold: false };
    listings.unshift(listing);
    res.status(201).json(listing);
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not save the listing. Please try again.' });
  }
});

// update listing using the same fields
app.put('/api/listings/:id', validateListing, async (req, res) =>
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
            image = $5,
            mime_type = $6
        WHERE id = $7
        RETURNING *`,
        [
            title.trim(),
            description.trim(),
            price,
            category,
            req.photoBytes,
            req.mimeType,
            req.params.id
        ]
    );
      listing = result.rows[0];
    }
    else
    {
      listing = listings.find((item) => item.id === Number(req.params.id));
      if (listing)
      {
        listing.title = title.trim();
        listing.description = description.trim();
        listing.price = Number(Number(price).toFixed(2));
        listing.category = category;
        listing.image = image;
      }
    }
    if (!listing)
    {
      return res.status(404).json({ error: 'Listing not found.' });
    }
    res.json(listing);
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not update the listing.' });
  }
});

// mark an item as sold
app.post('/api/listings/:id/buy', async (req, res) =>
{
  try
  {
    let listing;
    if (database)
    {
      const result = await database.query(
        'UPDATE listings SET sold = TRUE WHERE id = $1 AND sold = FALSE RETURNING *',
        [req.params.id]
      );
      listing = result.rows[0];
      if (!listing)
      {
        return res.status(409).json({ error: 'This listing is no longer available.' });
      }
    }
    else
    {
      listing = listings.find((item) => item.id === Number(req.params.id));
      if (!listing)
      {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      if (listing.sold)
      {
        return res.status(409).json({ error: 'This item is already sold.' });
      }
      listing.sold = true;
    }
    res.json(listing);
  }
  catch (error)
  {
    res.status(500).json({ error: 'Could not mark the item as sold. Check that your database table is up to date.' });
  }
});

// delete a listing permanently
app.delete('/api/listings/:id', async (req, res) =>
{
  try
  {
    if (database)
    {
      const result = await database.query('DELETE FROM listings WHERE id = $1 RETURNING id', [req.params.id]);
      if (result.rowCount === 0)
      {
        return res.status(404).json({ error: 'Listing not found.' });
      }
    }
    else
    {
      const index = listings.findIndex((item) => item.id === Number(req.params.id));
      if (index === -1)
      {
        return res.status(404).json({ error: 'Listing not found.' });
      }
      listings.splice(index, 1);
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
    console.log('No database connected. Listings and accounts reset when the server stops.');
  }
});
