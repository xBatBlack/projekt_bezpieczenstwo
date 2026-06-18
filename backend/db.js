const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'backend.db');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    });
};

module.exports = { db, initDb };
