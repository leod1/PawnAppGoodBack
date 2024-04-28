const express = require('express');
const { Database, aql } = require('arangojs');
const crypto = require('crypto'); // Import the crypto library
require('dotenv').config();
const cors = require('cors');

const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// Setup ArangoDB connection
const db = new Database({
  url: process.env.ARANGO_URL,
  databaseName: process.env.ARANGO_DB_NAME,
  auth: { username: process.env.ARANGO_USER, password: process.env.ARANGO_PASSWORD },
});
console.log(process.env.ARANGO_URL + process.env.ARANGO_DB_NAME + { username: process.env.ARANGO_USER, password: process.env.ARANGO_PASSWORD })
// Check database connection and setup collection
db.get().then(() => {
  console.log('Connected to ArangoDB');
  const users = db.collection('users');
  users.create().catch(err => console.log('Collection already exists'));
}).catch(err => console.error('Failed to connect to ArangoDB', err));


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to hash password with SHA-1 and a salt
function hashPassword(password) {
    const hash = crypto.createHash('sha1');
    hash.update(password);
    return hash.digest('hex');
}

// Register user
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Generate a salt
    const salt = crypto.randomBytes(16).toString('hex');

    // Check if user already exists
    const userExists = await db.query(aql`
      FOR user IN users
      FILTER user.username == ${username}
      RETURN user
    `);
    if (await userExists.next()) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash password with SHA-1 and salt
    const hashedPassword = hashPassword(password);

    // Store user with hashed password and salt
    await db.query(aql`
      INSERT { username: ${username}, password: ${hashedPassword}} INTO users
    `);
    res.status(201).json({ message: 'User registered' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = hashPassword(password);
    console.log('Login:', username, hashedPassword);

    await sleep(1000);
    // Retrieve user by username
    console.log(`
    FOR user IN users
    FILTER user.username == "${username}" && user.password == "${hashedPassword}"
    RETURN user
  `);
    const cursor = await db.query(aql`
        FOR user IN users
        FILTER user.username == ${username} && user.password == ${hashedPassword}
        RETURN user
    `);
    const user = await cursor.next();

    // Check user and hashed password
    if (user) {
      res.json({ message: 'Login successful on ' + user.username });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
