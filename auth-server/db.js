const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'auth.db');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                role TEXT
            )`);

            // Clients table
            db.run(`CREATE TABLE IF NOT EXISTS clients (
                client_id TEXT PRIMARY KEY,
                client_secret TEXT,
                redirect_uri TEXT
            )`);

            // Auth Codes table
            db.run(`CREATE TABLE IF NOT EXISTS auth_codes (
                code TEXT PRIMARY KEY,
                client_id TEXT,
                user_id INTEGER,
                redirect_uri TEXT,
                code_challenge TEXT,
                code_challenge_method TEXT,
                expires_at DATETIME
            )`);

            // Check if seed needed
            db.get("SELECT COUNT(*) AS count FROM users", async (err, row) => {
                if (err) return reject(err);
                if (row.count === 0) {
                    console.log("Seeding initial data...");
                    const adminPass = await bcrypt.hash('admin123', 10);
                    const userPass = await bcrypt.hash('user123', 10);
                    
                    const stmtUsers = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
                    stmtUsers.run("admin", adminPass, "admin");
                    stmtUsers.run("user", userPass, "user");
                    stmtUsers.finalize();

                    const stmtClients = db.prepare("INSERT INTO clients (client_id, client_secret, redirect_uri) VALUES (?, ?, ?)");
                    stmtClients.run("frontend-app", "secret123", "http://localhost:5173/callback");
                    stmtClients.finalize();
                    console.log("Seeding complete.");
                }
                resolve();
            });
        });
    });
};

module.exports = { db, initDb };
