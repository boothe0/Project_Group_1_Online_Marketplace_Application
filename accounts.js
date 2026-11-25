// randombytes creates the sign-in cookie id
const { randomBytes } = require('crypto');

// keep account routes together so app.js can focus on listings
<<<<<<< Updated upstream
module.exports = function setupAccounts(app, database)
=======
module.exports = function setupAccounts(app, database, listings, transactionReviews)
>>>>>>> Stashed changes
{
  const users = [];
  const sessions = new Map();
  let nextUserId = 1;
  const oneDay = 24 * 60 * 60 * 1000;
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  };

  function findUserByUserId(userId)
  {
    for (const user of users)
    {
      if (user.user_id === userId)
      {
        return user;
      }
    }
    return null;
  }

  // the cookie holds a random id account details stay on the server
  app.use((req, res, next) =>
  {
    const cookies = (req.headers.cookie || '').split(';');
    req.sessionToken = '';
    for (const cookie of cookies)
    {
      const text = cookie.trim();
      if (text.startsWith('nau_session='))
      {
        req.sessionToken = text.slice('nau_session='.length);
        break;
      }
    }
    const session = sessions.get(req.sessionToken);
    req.user = null;
    if (session && session.expires > Date.now())
    {
      req.user = session.user;
    }
    else
    {
      sessions.delete(req.sessionToken);
    }
    res.locals.user = req.user;
    next();
  });

  function startSession(req, res, user)
  {
    for (const [id, session] of sessions)
    {
      if (session.expires <= Date.now())
      {
        sessions.delete(id);
      }
    }
    sessions.delete(req.sessionToken);
    const token = randomBytes(32).toString('hex');
    const profile = { id: user.id, user_id: user.user_id, name: user.name, email: user.email };
    sessions.set(token, { user: profile, expires: Date.now() + oneDay });
    res.cookie('nau_session', token, {
      httpOnly: cookieOptions.httpOnly,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
      maxAge: oneDay
    });
  }

  app.post('/api/signup', async (req, res) =>
  {
    const { user_id, password, name, email } = req.body || {};
    const userIdIsValid = typeof user_id === 'string' && user_id.trim() !== '' && user_id.length <= 50;
    const nameIsValid = typeof name === 'string' && name.trim() !== '' && name.length <= 100;
    const emailIsValid = typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const passwordIsValid = typeof password === 'string' && password.length >= 8 && password.length <= 128;
    if (!userIdIsValid || !nameIsValid || !emailIsValid || !passwordIsValid)
    {
      return res.status(400).json({ error: 'Enter a user ID, name, valid email, and a password with 8 to 128 characters.' });
    }
    const userId = user_id.trim();
    try
    {
      if (database)
      {
        // first check whether this user id is already taken
        const result = await database.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
        if (result.rows.length > 0)
        {
          return res.status(409).json({ error: 'This user ID is already taken. Please choose a different user ID.' });
        }
        // store the new account using the values from the form
        await database.query(
          'INSERT INTO users (user_id, password, name, email) VALUES ($1, $2, $3, $4)',
          [userId, password, name.trim(), email.trim().toLowerCase()]
        );
      }
      else
      {
        // use memory only when postgresql is not configured
        if (findUserByUserId(userId))
        {
          return res.status(409).json({ error: 'This user ID is already taken. Please choose a different user ID.' });
        }
        const user = { id: nextUserId++, user_id: userId, password: password, name: name.trim(), email: email.trim().toLowerCase(), bio: '' };
        users.push(user);
      }
      // the signup page sends the user to signin after this response
      res.status(201).json({ message: 'Account created. Please sign in.' });
    }
    catch (error)
    {
      // the unique constraint also prevents two requests taking the same id
      if (error.code === '23505')
      {
        return res.status(409).json({ error: 'This user ID is already taken. Please choose a different user ID.' });
      }
      res.status(500).json({ error: 'Could not create the account. Check your database setup.' });
    }
  });

  app.post('/api/signin', async (req, res) =>
  {
    const { user_id, password } = req.body || {};
    if (typeof user_id !== 'string' || !user_id.trim() || user_id.length > 50 ||
        typeof password !== 'string' || password.length < 8 || password.length > 128)
    {
      return res.status(401).json({ error: 'User ID or password is incorrect. Please try again.' });
    }
    try
    {
      let user;
      if (database)
      {
        // find an account with both the matching user id and password
        const result = await database.query(
          'SELECT id, user_id, name, email FROM users WHERE user_id = $1 AND password = $2',
          [user_id.trim(), password]
        );
        user = result.rows[0];
      }
      else
      {
        user = findUserByUserId(user_id.trim());
        if (user && user.password !== password)
        {
          user = null;
        }
      }
      if (!user)
      {
        return res.status(401).json({ error: 'User ID or password is incorrect. Please try again.' });
      }
      startSession(req, res, user);
      // the signin page sends the user to the marketplace feed
      res.json({ message: 'Signed in.' });
    }
    catch (error)
    {
      res.status(500).json({ error: 'Could not sign in. Check your database setup.' });
    }
  });

  app.post('/logout', (req, res) =>
  {
    sessions.delete(req.sessionToken);
    res.clearCookie('nau_session', cookieOptions);
    res.redirect(303, '/');
  });

  async function loadProfile(userId, includeEmail)
  {
    let account;
    if (database)
    {
      const result = await database.query(
        'SELECT id, user_id, name, email, bio FROM users WHERE user_id = $1',
        [userId]
      );
      account = result.rows[0];
    }
    else
    {
      account = findUserByUserId(userId);
    }
    if (!account)
    {
      return null;
    }

    const profile = { user_id: account.user_id, name: account.name, bio: account.bio };
    if (includeEmail)
    {
      profile.email = account.email;
    }

    let profileListings;
    if (database)
    {
      const result = await database.query(`
        SELECT listings.id, title, description, price, category, sold,
          'data:' || mime_type || ';base64,' || replace(encode(image, 'base64'), chr(10), '') AS image,
          CASE WHEN reviews.listing_id IS NOT NULL
            THEN json_build_object('rating', reviews.rating, 'feedback', reviews.feedback)
          END AS review
        FROM listings
        LEFT JOIN reviews ON reviews.listing_id = listings.id
        WHERE listings.seller_id = $1
        ORDER BY listings.id DESC
      `, [account.id]);
      profileListings = result.rows;
    }
    else
    {
      profileListings = listings
        .filter((listing) => listing.seller_id === account.id)
        .map(({ id, title, description, price, category, image, sold }) =>
        {
          const savedReview = transactionReviews.get(id);
          const review = savedReview ? { rating: savedReview.rating, feedback: savedReview.feedback } : null;
          return { id, title, description, price, category, image, sold, review };
        });
    }
    return { profile, listings: profileListings };
  }

  async function sendProfile(res, userId, includeEmail)
  {
    res.set('Cache-Control', 'no-store');
    try
    {
<<<<<<< Updated upstream
      let profile;
      if (database)
      {
        const account = await database.query('SELECT user_id, name, email, bio FROM users WHERE id = $1', [req.user.id]);
        profile = account.rows[0];
      }
      else
      {
        profile = users.find((user) => user.id === req.user.id);
      }
      if (!profile)
      {
        return res.redirect('/signin');
      }
      res.status(status).render('profile', { profile, message });
=======
      const data = await loadProfile(userId, includeEmail);
      if (!data)
      {
        return res.status(404).json({ error: 'Profile not found.' });
      }
      res.json(data);
>>>>>>> Stashed changes
    }
    catch (error)
    {
      res.status(500).json({ error: 'Could not load the profile.' });
    }
  }

  app.get('/api/profile', (req, res) =>
  {
    if (!req.user)
    {
      return res.status(401).json({ error: 'Sign in to view your profile.' });
    }
    return sendProfile(res, req.user.user_id, true);
  });

  app.get('/api/users/:userId', (req, res) =>
  {
    return sendProfile(res, req.params.userId, false);
  });

  async function showProfile(req, res, userId, message = '', status = 200)
  {
    res.set('Cache-Control', 'no-store');
    const isOwnProfile = Boolean(req.user && req.user.user_id === userId);
    try
    {
      const data = await loadProfile(userId, isOwnProfile);
      if (!data)
      {
        return res.status(404).send('Profile not found.');
      }
      res.status(status).render('profile', { ...data, isOwnProfile, message });
    }
    catch (error)
    {
      res.status(500).send('Could not load the profile.');
    }
  }

  app.get('/profile', (req, res) =>
  {
    if (req.query.user !== undefined)
    {
      if (typeof req.query.user !== 'string' || !req.query.user || req.query.user.length > 50)
      {
        return res.status(400).send('Invalid user ID.');
      }
      return showProfile(req, res, req.query.user);
    }
    if (!req.user)
    {
      return res.redirect('/signin');
    }
    const message = req.query.saved === '1' ? 'Bio Saved!' : '';
    return showProfile(req, res, req.user.user_id, message);
  });

  app.post('/profile', async (req, res) =>
  {
    if (!req.user)
    {
      return res.redirect(303, '/signin');
    }
    const { bio } = req.body || {};
    if (typeof bio !== 'string' || bio.length > 500)
    {
      return showProfile(req, res, req.user.user_id, 'Keep your bio to 500 characters or less.', 400);
    }
    try
    {
      if (database)
      {
        await database.query('UPDATE users SET bio = $1 WHERE id = $2', [bio.trim(), req.user.id]);
      }
      else
      {
        const user = users.find((account) => account.id === req.user.id);
        user.bio = bio.trim();
      }
      res.redirect(303, '/profile?saved=1');
    }
    catch (error)
    {
      return showProfile(req, res, req.user.user_id, 'Could not save your bio. Please try again.', 500);
    }
  });
};
