require('dotenv').config(); // Ensure this is the VERY FIRST line
const express = require('express');
const axios = require('axios');
const session = require('express-session');
const { passport, exchangeCodeForToken } = require('./auth'); // Import passport and the exchange function
const app = express();
const port = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Session setup - Use secret from .env and initialize Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret', // Use secret from .env
  resave: false,
  saveUninitialized: false, // Don't save uninitialized sessions
  cookie: { secure: process.env.NODE_ENV === 'production' } // Set secure cookie in production
}));

// Initialize Passport and session support
app.use(passport.initialize());
app.use(passport.session());

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Routes
app.get('/', (req, res) => {
  if (req.isAuthenticated()) { // Check if authenticated via Passport
    return res.redirect('/home');
  }
  res.render('login', { error: req.session.messages ? req.session.messages.join(', ') : null }); // Display flash messages if any
  req.session.messages = []; // Clear messages after displaying
});

// --- Authentication Routes ---

// --- Authentication Routes ---

// 1. Initiate OAuth flow - Redirect user to Mastodon instance
app.get('/auth/mastodon', passport.authenticate('mastodon'));

// 2. Page to enter authorization code
app.get('/enter_code', (req, res) => {
  res.render('enter_code', { error: null });
});

// 3. Callback URL (OOB specific) - Show page to enter the code
// Note: passport.authenticate is called again here, but with OOB, it doesn't automatically handle the code.
// We redirect to a page where the user can manually enter the code.
// The 'failureRedirect' and 'failureMessage' handle potential errors during the initial redirect phase.
app.get('/auth/mastodon/callback',
  passport.authenticate('mastodon', { failureRedirect: '/', failureMessage: true }),
  (req, res) => {
    // If authentication was somehow successful already (unlikely with OOB), redirect home.
    // Otherwise, render the page to enter the code.
    if (req.isAuthenticated()) {
      res.redirect('/home');
    } else {
      // This part is reached *after* the user authorizes on Mastodon and is shown the code.
      // They manually navigate back or are instructed to go here.
      // We render a view for them to paste the code.
      res.render('enter_code', { error: null });
    }
  }
);

// 3. Submit Code (OOB specific) - Exchange code for token
app.post('/submit-code', async (req, res, next) => {
  const { code } = req.body;
  if (!code) {
    return res.render('enter_code', { error: 'Authorization code is required.' });
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    // Store the obtained token in the session
    req.session.accessToken = accessToken;
    req.session.instanceUrl = process.env.INSTANCE_URL; // Store instance URL

    // Verify credentials with the new token and get user profile
    const verifyResponse = await axios.get(`${process.env.INSTANCE_URL}/api/v1/accounts/verify_credentials`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const userProfile = verifyResponse.data;
    // Attach the access token to the user profile
    userProfile.accessToken = accessToken;

    // Manually log the user in using Passport's req.login
    // We pass the fetched profile data as the user object.
    req.login(userProfile, (err) => {
      if (err) { return next(err); }
      // Regenerate session after login to prevent fixation attacks
      req.session.regenerate((err) => {
        if (err) { return next(err); }
        req.session.accessToken = accessToken; // Store access token in session
        req.session.instanceUrl = process.env.INSTANCE_URL; // Store instance URL
        req.session.save((err) => {
          if (err) { return next(err); }
          res.redirect('/home');
        });
      });
    });

  } catch (error) {
    console.error('Error during code submission or verification:', error);
    res.render('enter_code', { error: 'Failed to verify authorization code. Please try again.' });
  }
});

// 4. Logout
app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return next(err);
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.redirect('/');
    });
  });
});


// --- Application Routes (Protected) ---

app.get('/home', ensureAuthenticated, async (req, res) => {
  // Access token is now expected to be in req.session.accessToken
  if (!req.session.accessToken) {
     console.error('Access token missing in /home route despite ensureAuthenticated');
     return res.render('error', { message: 'Authentication error. Please log in again.' });
  }
  const instanceUrl = req.session.instanceUrl || process.env.INSTANCE_URL; // Get instance URL

  try {
    // Fetch initial home timeline posts from Mastodon API
    const response = await axios.get(`${instanceUrl}/api/v1/timelines/home`, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}` // Use token from session
      },
      params: {
        limit: 10 // Fetch only 10 posts initially
      }
    });

    // Render the timeline with the initial posts
    res.render('timeline', {
      posts: response.data,
      currentView: 'home', // Pass current view for API calls
      instanceUrl: instanceUrl // Pass instance URL to view if needed
    });
  } catch (error) {
    console.error('Error fetching home timeline:', error.response ? error.response.data : error.message);
    // Check for 401 Unauthorized specifically
    if (error.response && error.response.status === 401) {
       req.logout(function(err) {
         req.session.destroy(() => {
           res.clearCookie('connect.sid');
           res.redirect('/?error=session_expired'); // Redirect with error query
         });
       });
    } else {
      res.render('error', { message: 'Failed to fetch home timeline' });
    }
  }
});

app.get('/local', ensureAuthenticated, async (req, res) => {
  if (!req.session.accessToken) {
     console.error('Access token missing in /local route despite ensureAuthenticated');
     return res.render('error', { message: 'Authentication error. Please log in again.' });
  }
  const instanceUrl = req.session.instanceUrl || process.env.INSTANCE_URL;

  try {
    // Fetch initial local timeline posts from Mastodon API
    const response = await axios.get(`${req.session.instanceUrl}/api/v1/timelines/public`, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}` // Use token from session
      },
      params: {
        local: true,
        limit: 10 // Fetch only 10 posts initially
      }
    });

    // Render the timeline with the initial posts
    res.render('timeline', {
      posts: response.data,
      currentView: 'local', // Pass current view for API calls
      instanceUrl: instanceUrl
    });
  } catch (error) {
    console.error('Error fetching local timeline:', error.response ? error.response.data : error.message);
     if (error.response && error.response.status === 401) {
       req.logout(function(err) {
         req.session.destroy(() => {
           res.clearCookie('connect.sid');
           res.redirect('/?error=session_expired');
         });
       });
    } else {
      res.render('error', { message: 'Failed to fetch local timeline' });
    }
  }
});

app.get('/public', ensureAuthenticated, async (req, res) => {
   if (!req.session.accessToken) {
     console.error('Access token missing in /public route despite ensureAuthenticated');
     return res.render('error', { message: 'Authentication error. Please log in again.' });
  }
  const instanceUrl = req.session.instanceUrl || process.env.INSTANCE_URL;

  try {
    // Fetch initial public timeline posts from Mastodon API
    const response = await axios.get(`${req.session.instanceUrl}/api/v1/timelines/public`, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}` // Use token from session
      },
      params: {
        limit: 10 // Fetch only 10 posts initially
      }
    });

    // Render the timeline with the initial posts
    res.render('timeline', {
      posts: response.data,
      currentView: 'public', // Pass current view for API calls
      instanceUrl: instanceUrl
    });
  } catch (error) {
    console.error('Error fetching public timeline:', error.response ? error.response.data : error.message);
     if (error.response && error.response.status === 401) {
       req.logout(function(err) {
         req.session.destroy(() => {
           res.clearCookie('connect.sid');
           res.redirect('/?error=session_expired');
         });
       });
    } else {
      res.render('error', { message: 'Failed to fetch public timeline' });
    }
  }
});

// API endpoint to fetch more posts - protected
app.get('/api/timeline/:view/more', ensureAuthenticated, async (req, res) => {
  if (!req.session.accessToken) {
     // This check might be redundant due to ensureAuthenticated, but good for clarity
     console.error('Access token missing in API route despite ensureAuthenticated');
     return res.status(401).json({ error: 'Unauthorized' });
  }
  const instanceUrl = req.session.instanceUrl || process.env.INSTANCE_URL;

  const view = req.params.view;
  const max_id = req.query.max_id;

  if (!max_id) {
    return res.status(400).json({ error: 'max_id is required' });
  }

  try {
    let url = `${instanceUrl}/api/v1/timelines/home`;
    let params = { limit: 10, max_id: max_id };

    if (view === 'public') {
      url = `${instanceUrl}/api/v1/timelines/public`;
    } else if (view === 'local') {
      url = `${instanceUrl}/api/v1/timelines/public`;
      params.local = true; // Add local=true for local timeline
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}` // Use token from session
      },
      params: params // Use the constructed params object
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching more timeline posts:', error.response ? error.response.data : error.message);
    // Handle potential 401 Unauthorized error during API call
    if (error.response && error.response.status === 401) {
      // Optionally trigger logout or just return error
       return res.status(401).json({ error: 'Unauthorized - Invalid token?' });
    }
    res.status(500).json({ error: 'Failed to fetch more timeline posts' });
  }
});

// Remove the old POST /login route as it's replaced by the OAuth flow
// app.post('/login', async (req, res) => { ... });


app.listen(port, () => {
  console.log(`E-ink Mastodon app listening at http://localhost:${port}`);
});
