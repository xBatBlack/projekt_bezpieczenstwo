const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { db, initDb } = require('./db');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(cookieParser());
app.set('view engine', 'ejs');

const PORT = 4000;
const JWT_SECRET = 'super-secret-key-for-project';

// Helper to generate random string
const generateRandomString = (length) => crypto.randomBytes(length).toString('hex');

app.get('/authorize', (req, res) => {
    const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method } = req.query;

    if (response_type !== 'code' || !client_id || !redirect_uri || !code_challenge) {
        return res.status(400).send('Invalid request. Missing parameters.');
    }

    // Verify client
    db.get('SELECT * FROM clients WHERE client_id = ? AND redirect_uri = ?', [client_id, redirect_uri], (err, row) => {
        if (err || !row) return res.status(400).send('Invalid client or redirect URI.');

        // Render login page
        res.render('login', {
            client_id,
            redirect_uri,
            code_challenge,
            code_challenge_method: code_challenge_method || 'plain',
            error: null
        });
    });
});

app.post('/login', (req, res) => {
    const { username, password, client_id, redirect_uri, code_challenge, code_challenge_method } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) {
            return res.render('login', { client_id, redirect_uri, code_challenge, code_challenge_method, error: 'Invalid username or password' });
        }

        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) {
            return res.render('login', { client_id, redirect_uri, code_challenge, code_challenge_method, error: 'Invalid username or password' });
        }

        // Generate auth code
        const code = generateRandomString(16);
        const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

        db.run(`INSERT INTO auth_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
            [code, client_id, user.id, redirect_uri, code_challenge, code_challenge_method, expiresAt], 
            (err) => {
                if (err) return res.status(500).send('Server error');
                
                // Redirect back to client with code
                res.redirect(`${redirect_uri}?code=${code}`);
            }
        );
    });
});

app.post('/token', (req, res) => {
    const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body;

    if (grant_type !== 'authorization_code') {
        return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    db.get('SELECT * FROM auth_codes WHERE code = ? AND client_id = ? AND redirect_uri = ?', 
        [code, client_id, redirect_uri], 
        (err, authCode) => {
            if (err || !authCode) {
                return res.status(400).json({ error: 'invalid_grant' });
            }

            if (new Date(authCode.expires_at) < new Date()) {
                return res.status(400).json({ error: 'invalid_grant', message: 'Code expired' });
            }

            // Verify PKCE
            let isValidPkce = false;
            if (authCode.code_challenge_method === 'S256') {
                const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
                isValidPkce = (hash === authCode.code_challenge);
            } else {
                isValidPkce = (code_verifier === authCode.code_challenge);
            }

            if (!isValidPkce) {
                return res.status(400).json({ error: 'invalid_grant', message: 'PKCE verification failed' });
            }

            // Delete used code
            db.run('DELETE FROM auth_codes WHERE code = ?', [code]);

            // Issue Token
            db.get('SELECT * FROM users WHERE id = ?', [authCode.user_id], (err, user) => {
                if (err || !user) return res.status(500).json({ error: 'server_error' });

                const payload = {
                    sub: user.id,
                    username: user.username,
                    role: user.role
                };

                const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

                res.json({
                    access_token,
                    token_type: 'Bearer',
                    expires_in: 3600
                });
            });
        }
    );
});

initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Auth Server running on http://localhost:${PORT}`);
    });
}).catch(console.error);
