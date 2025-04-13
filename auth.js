require('dotenv').config(); // Load .env variables within this module too
const passport = require('passport');
const MastodonStrategy = require('passport-mastodon').Strategy;
const axios = require('axios');

// Ensure environment variables are loaded before using them
if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.CALLBACK_URL || !process.env.INSTANCE_URL) {
  console.error("Error: Missing required environment variables for Mastodon OAuth.");
  // Optionally, throw an error or exit if critical variables are missing
  // throw new Error("Missing required environment variables.");
}

// Configure Passport to use the Mastodon strategy
// Construct the URLs first to ensure they're ready before strategy initialization
const authorizationURL = `${process.env.INSTANCE_URL}/oauth/authorize`;
const tokenURL = `${process.env.INSTANCE_URL}/oauth/token`;

passport.use(new MastodonStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL, // urn:ietf:wg:oauth:2.0:oob
    authorizationURL: authorizationURL, // Add this back
    tokenURL: tokenURL, // Add this too for token exchange
    scope: 'read', // We only need read access for viewing timelines
    passReqToCallback: true // Allows passing req to the verify callback
  },
  // This verify callback is typically used with HTTP redirects,
  // but for OOB, we handle token exchange manually after getting the code.
  // We still need it for passport setup.
  (req, accessToken, refreshToken, profile, done) => {
    // In OOB, this callback might not receive the accessToken directly.
    // We store the profile and potentially the token if available.
    // The actual token exchange happens after the user submits the code.
    req.session.accessToken = accessToken; // Store token if passport-mastodon provides it here
    req.session.profile = profile; // Store profile
    return done(null, profile);
  }
));

// Serialize user information into the session
passport.serializeUser((user, done) => {
  done(null, user); // Store the whole user profile in the session for simplicity
});

// Deserialize user information from the session
passport.deserializeUser((user, done) => {
  // Retrieve the access token from the session and attach it to the user object
  const accessToken = user.accessToken; // Assuming accessToken is stored directly on the user object
  if (accessToken) {
    user.accessToken = accessToken; // Ensure accessToken is available
  }
  done(null, user);
});

// Function to manually exchange authorization code for access token (OOB flow)
async function exchangeCodeForToken(code) {
  try {
    const response = await axios.post(`${process.env.INSTANCE_URL}/oauth/token`, null, {
      params: {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.CALLBACK_URL, // Must match the one used to get the code
        grant_type: 'authorization_code',
        code: code,
        scope: 'read' // Should match the scope requested initially
      }
    });
    return response.data.access_token; // Return the access token
  } catch (error) {
    console.error('Error exchanging code for token:', error.response ? error.response.data : error.message);
    throw new Error('Failed to exchange authorization code for token.');
  }
}

module.exports = { passport, exchangeCodeForToken };
