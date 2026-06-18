const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { db, initDb } = require('./db');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
const JWT_SECRET = 'super-secret-key-for-project'; // In production, this would be retrieved from env or Auth Server JWKS

// 1. Unsecured endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Role Checking Middleware
const requireRole = (role) => {
    return (req, res, next) => {
        if (req.user && req.user.role === role) {
            next();
        } else {
            res.status(403).json({ error: 'Access denied. Requires role: ' + role });
        }
    };
};

// 2. Secured endpoint: GET notes
app.get('/api/notes', authenticateToken, (req, res) => {
    db.all('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC', [req.user.sub], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// 3. Secured endpoint: POST note
app.post('/api/notes', authenticateToken, (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    db.run('INSERT INTO notes (user_id, content) VALUES (?, ?)', [req.user.sub, content], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ id: this.lastID, content });
    });
});

// 4. Secured endpoint: DELETE note
app.delete('/api/notes/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    // Ensure the user owns the note or is admin
    db.get('SELECT * FROM notes WHERE id = ?', [id], (err, note) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!note) return res.status(404).json({ error: 'Note not found' });
        
        if (note.user_id !== req.user.sub && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to delete this note' });
        }

        db.run('DELETE FROM notes WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ success: true });
        });
    });
});

// 5. Secured endpoint considering user roles: GET admin stats
app.get('/api/admin/stats', authenticateToken, requireRole('admin'), (req, res) => {
    db.get('SELECT COUNT(*) as totalNotes FROM notes', [], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({
            message: 'Welcome Admin',
            totalNotesInSystem: row.totalNotes,
            systemStatus: 'Healthy'
        });
    });
});

initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Backend Server (Resource) running on http://localhost:${PORT}`);
    });
}).catch(console.error);
