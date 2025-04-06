const express = require('express');
const axios = require('axios');
const session = require('express-session');
const helmet = require('helmet');
const { URL } = require('url');
const app = express();
const port = process.env.PORT || 3000;

// Load environment variables
require('dotenv').config();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Add security headers using helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// Session setup for storing auth tokens
// Check for session secret in environment variables
const sessionSecret = process.env.SESSION_SECRET || 'change-this-to-a-secure-secret';
if (sessionSecret === 'change-this-to-a-secure-secret') {
  console.warn('WARNING: Using default session secret. Set SESSION_SECRET in environment variables for production use.');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false, // Changed to false for better security
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.get('/', (req, res) => {
  if (!req.session.accessToken) {
    return res.render('login', { error: null });
  }
  res.redirect('/home');
});

app.get('/home', async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect('/');
  }

  try {
    // Fetch initial home timeline posts from Mastodon API
    const response = await axios.get(`${req.session.instanceUrl}/api/v1/timelines/home`, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`
      },
      params: {
        limit: 10 // Fetch only 10 posts initially
      }
    });

    // Render the timeline with the initial posts
    res.render('timeline', {
      posts: response.data,
      currentView: 'home' // Pass current view for API calls
    });
  } catch (error) {
    console.error('Error fetching home timeline:', error);
    let errorMessage = 'Failed to fetch timeline';
    
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      if (error.response.status === 401) {
        errorMessage = 'Authentication error. Please try logging in again.';
      } else if (error.response.status === 404) {
        errorMessage = 'Resource not found. Please check your instance URL.';
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'Could not connect to the Mastodon instance. Please check your internet connection.';
    }
    
    res.render('error', { message: errorMessage });
  }
});

app.get('/local', async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect('/');
  }

  try {
    // Fetch initial local timeline posts from Mastodon API
    const response = await axios.get(`${req.session.instanceUrl}/api/v1/timelines/public`, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`
      },
      params: {
        local: true,
        limit: 10 // Fetch only 10 posts initially
      }
    });

    // Render the timeline with the initial posts
    res.render('timeline', {
      posts: response.data,
      currentView: 'local' // Pass current view for API calls
    });
  } catch (error) {
    console.error('Error fetching local timeline:', error);
    let errorMessage = 'Failed to fetch timeline';
    
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      if (error.response.status === 401) {
        errorMessage = 'Authentication error. Please try logging in again.';
      } else if (error.response.status === 404) {
        errorMessage = 'Resource not found. Please check your instance URL.';
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'Could not connect to the Mastodon instance. Please check your internet connection.';
    }
    
    res.render('error', { message: errorMessage });
  }
});

app.get('/public', async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect('/');
  }

  try {
    // Fetch initial public timeline posts from Mastodon API
    const response = await axios.get(`${req.session.instanceUrl}/api/v1/timelines/public`, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`
      },
      params: {
        limit: 10 // Fetch only 10 posts initially
      }
    });

    // Render the timeline with the initial posts
    res.render('timeline', {
      posts: response.data,
      currentView: 'public' // Pass current view for API calls
    });
  } catch (error) {
    console.error('Error fetching public timeline:', error);
    let errorMessage = 'Failed to fetch timeline';
    
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      if (error.response.status === 401) {
        errorMessage = 'Authentication error. Please try logging in again.';
      } else if (error.response.status === 404) {
        errorMessage = 'Resource not found. Please check your instance URL.';
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorMessage = 'Could not connect to the Mastodon instance. Please check your internet connection.';
    }
    
    res.render('error', { message: errorMessage });
  }
});

app.get('/api/timeline/:view/more', async (req, res) => {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const view = req.params.view;
  const max_id = req.query.max_id;

  if (!max_id) {
    return res.status(400).json({ error: 'max_id is required' });
  }

  try {
    let url = `${req.session.instanceUrl}/api/v1/timelines/home`;
    if (view === 'public') {
      url = `${req.session.instanceUrl}/api/v1/timelines/public`;
    } else if (view === 'local') {
      url = `${req.session.instanceUrl}/api/v1/timelines/public?local=true`;
    }

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`
      },
      params: {
        limit: 10,
        max_id: max_id
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching more timeline posts:', error);
    
    let errorMessage = 'Failed to fetch more timeline posts';
    let statusCode = 500;
    
    if (error.response) {
      statusCode = error.response.status;
      if (error.response.status === 401) {
        errorMessage = 'Authentication error';
      } else if (error.response.status === 404) {
        errorMessage = 'Resource not found';
      }
    } else if (error.request) {
      errorMessage = 'Could not connect to the Mastodon instance';
    }
    
    res.status(statusCode).json({ error: errorMessage });
  }
});

// Login form submission
app.post('/login', async (req, res) => {
  const { instance, access_token } = req.body;
  
  if (!instance || !access_token) {
    return res.render('login', { error: 'Please provide both instance URL and access token' });
  }

  // Validate instance URL
  let instanceUrl;
  try {
    // Add https:// if not present
    const urlToCheck = instance.startsWith('http') ? instance : `https://${instance}`;
    const parsedUrl = new URL(urlToCheck);
    
    // Ensure protocol is https for security
    if (parsedUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      return res.render('login', { error: 'Instance URL must use HTTPS for security' });
    }
    
    // Validate the domain looks like a Mastodon instance
    if (!parsedUrl.hostname.includes('.')) {
      return res.render('login', { error: 'Invalid instance URL format' });
    }
    
    instanceUrl = parsedUrl.origin;
  } catch (error) {
    console.error('URL validation error:', error);
    return res.render('login', { error: 'Invalid instance URL format' });
  }
  
  try {
    // Verify the token by fetching the user's account
    const response = await axios.get(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    // Store the credentials in session
    req.session.accessToken = access_token;
    req.session.instanceUrl = instanceUrl;
    req.session.user = response.data;
    
    res.redirect('/home');
  } catch (error) {
    console.error('Login error:', error);
    
    let errorMessage = 'Invalid credentials or instance URL';
    
    if (error.response) {
      // Handle specific response status codes
      if (error.response.status === 401 || error.response.status === 403) {
        errorMessage = 'Invalid access token. Please check your credentials.';
      } else if (error.response.status === 404) {
        errorMessage = 'API endpoint not found. Is this a valid Mastodon instance?';
      } else if (error.response.status >= 500) {
        errorMessage = 'The Mastodon server is experiencing issues. Please try again later.';
      }
    } else if (error.request) {
      errorMessage = 'Could not connect to the Mastodon instance. Please check the URL and your internet connection.';
    }
    
    res.render('login', { error: errorMessage });
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).render('error', { 
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : `Error: ${err.message}`
  });
});

app.listen(port, () => {
  console.log(`E-ink Mastodon app listening on port ${port}`);
});
