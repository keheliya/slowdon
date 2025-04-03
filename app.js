const express = require('express');
const axios = require('axios');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Session setup for storing auth tokens
app.use(session({
  secret: 'change-this-to-a-secure-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
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
    console.error('Error fetching timeline:', error);
    res.render('error', { message: 'Failed to fetch timeline' });
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
    console.error('Error fetching timeline:', error);
    res.render('error', { message: 'Failed to fetch timeline' });
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
    console.error('Error fetching timeline:', error);
    res.render('error', { message: 'Failed to fetch timeline' });
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
    res.status(500).json({ error: 'Failed to fetch more timeline posts' });
  }
});

// Login form submission
app.post('/login', async (req, res) => {
  const { instance, access_token } = req.body;
  
  if (!instance || !access_token) {
    return res.render('login', { error: 'Please provide both instance URL and access token' });
  }
  
  const instanceUrl = instance.startsWith('http') ? instance : `https://${instance}`;
  
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
    res.render('login', { error: 'Invalid credentials or instance URL' });
  }
});


app.listen(port, () => {
  console.log(`E-ink Mastodon app listening on port ${port}`);
});
