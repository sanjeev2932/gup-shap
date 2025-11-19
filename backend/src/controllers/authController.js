// controllers/authController.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const USERS_FILE = path.join(__dirname, '..', 'users.json');
const SALT_ROUNDS = 10;

// helper to read/write users.json
function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

exports.register = async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    const users = readUsers();
    const existing = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'username taken' });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = {
      id: uuidv4(),
      username,
      name: name || username,
      password: hashed,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    writeUsers(users);

    // send back user (without password)
    const { password: pw, ...sanitized } = user;
    return res.status(201).json({ user: sanitized });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ error: 'server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'invalid credentials' });

    const { password: pw, ...sanitized } = user;
    return res.json({ user: sanitized });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'server error' });
  }
};
