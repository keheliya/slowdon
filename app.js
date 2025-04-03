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
    // Fetch home timeline from Mastodon API
    const response = await axios.get(`${req.session.instanceUrl}/api/v1/timelines/home`, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`
      }
    });
    
    // Render the timeline with the fetched posts
    res.render('timeline', { 
      posts: response.data, 
      page: 1, 
      pageSize: 10,
      totalPages: Math.ceil(response.data.length / 10),
      currentView: 'home'
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.render('error', { message: 'Failed to fetch timeline' });
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

// Route for navigation (for page up/down functionality)
app.get('/timeline/:view/:page', async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect('/');
  }
  
  const view = req.params.view;
  const page = parseInt(req.params.page) || 1;
  const pageSize = 10;
  
  try {
    // Determine which timeline to fetch
    let url = `${req.session.instanceUrl}/api/v1/timelines/home`;
    if (view === 'public') {
      url = `${req.session.instanceUrl}/api/v1/timelines/public`;
    } else if (view === 'local') {
      url = `${req.session.instanceUrl}/api/v1/timelines/public?local=true`;
    }
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${req.session.accessToken}`
      }
    });
    
    // Calculate pagination
    const totalPosts = response.data.length;
    const totalPages = Math.ceil(totalPosts / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPosts = response.data.slice(startIndex, endIndex);
    
    res.render('timeline', { 
      posts: paginatedPosts,
      page: page,
      pageSize: pageSize,
      totalPages: totalPages,
      currentView: view
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.render('error', { message: 'Failed to fetch timeline' });
  }
});

app.listen(port, () => {
  console.log(`E-ink Mastodon app listening on port ${port}`);
});