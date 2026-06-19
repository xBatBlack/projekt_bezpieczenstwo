import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { generateRandomString, generateCodeChallenge } from './pkce';
import { AuthProvider, useAuth } from './AuthContext';

const CLIENT_ID = 'frontend-app';
const REDIRECT_URI = 'http://localhost:5173/callback';
const AUTH_SERVER_URL = 'http://localhost:4000';
const BACKEND_URL = 'http://localhost:3000';

const Home = () => {
    const { token } = useAuth();
    
    const handleLogin = async () => {
        const codeVerifier = generateRandomString(64);
        window.localStorage.setItem('code_verifier', codeVerifier);
        
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        const authUrl = new URL(`${AUTH_SERVER_URL}/authorize`);
        authUrl.searchParams.append('client_id', CLIENT_ID);
        authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('code_challenge', codeChallenge);
        authUrl.searchParams.append('code_challenge_method', 'S256');
        
        window.location.href = authUrl.toString();
    };

    if (token) return <Navigate to="/notes" />;

    return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
            <h1>Web Security Project</h1>
            <button onClick={handleLogin} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
                Login with OAuth 2.0 (PKCE)
            </button>
            <div style={{ marginTop: '20px' }}>
                <p>Status Serwera Zasobów: <HealthCheck /></p>
            </div>
        </div>
    );
};

const HealthCheck = () => {
    const [status, setStatus] = useState('Checking...');
    useEffect(() => {
        axios.get(`${BACKEND_URL}/health`)
            .then(res => setStatus(res.data.status))
            .catch(() => setStatus('Offline'));
    }, []);
    return <b>{status}</b>;
};

const Callback = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const fetchToken = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const codeVerifier = window.localStorage.getItem('code_verifier');

            if (code && codeVerifier) {
                try {
                    const res = await axios.post(`${AUTH_SERVER_URL}/token`, {
                        grant_type: 'authorization_code',
                        client_id: CLIENT_ID,
                        redirect_uri: REDIRECT_URI,
                        code: code,
                        code_verifier: codeVerifier
                    });

                    login(res.data.access_token);
                    navigate('/notes');
                } catch (err) {
                    console.error('Token fetch error', err);
                    navigate('/');
                }
            } else {
                navigate('/');
            }
        };
        fetchToken();
    }, [navigate, login]);

    return <div style={{ padding: '2rem' }}>Processing login...</div>;
};

const Notes = () => {
    const { token, logout } = useAuth();
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');

    const fetchNotes = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/notes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotes(res.data);
        } catch (err) {
            if (err.response && err.response.status === 401) logout();
        }
    };

    useEffect(() => { fetchNotes(); }, [token]);

    const addNote = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${BACKEND_URL}/api/notes`, { content: newNote }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewNote('');
            fetchNotes();
        } catch (err) { console.error(err); }
    };

    const deleteNote = async (id) => {
        try {
            await axios.delete(`${BACKEND_URL}/api/notes/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchNotes();
        } catch (err) { console.error(err); }
    };

    if (!token) return <Navigate to="/" />;

    return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Your Notes</h2>
                <button onClick={logout}>Logout</button>
            </div>
            
            <form onSubmit={addNote} style={{ marginBottom: '20px' }}>
                <input 
                    value={newNote} 
                    onChange={e => setNewNote(e.target.value)} 
                    placeholder="New note..." 
                    style={{ width: '70%', padding: '8px' }}
                />
                <button type="submit" style={{ width: '25%', padding: '8px', marginLeft: '5%' }}>Add</button>
            </form>

            <ul style={{ listStyle: 'none', padding: 0 }}>
                {notes.map(note => (
                    <li key={note.id} style={{ background: '#f4f4f9', margin: '10px 0', padding: '10px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{note.content}</span>
                        <button onClick={() => deleteNote(note.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>Delete</button>
                    </li>
                ))}
            </ul>

            <div style={{ marginTop: '40px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
                <h3>Admin Area</h3>
                <AdminPanel token={token} />
            </div>
        </div>
    );
};

const AdminPanel = ({ token }) => {
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(null);

    const fetchAdminStats = async () => {
        try {
            const res = await axios.get(`${BACKEND_URL}/api/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
            setError(null);
        } catch (err) {
            setError('Access Denied: Admin role required');
        }
    };

    return (
        <div>
            <button onClick={fetchAdminStats}>Fetch Admin Stats</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {stats && (
                <div style={{ background: '#e0ffe0', padding: '10px', marginTop: '10px' }}>
                    <p>Message: {stats.message}</p>
                    <p>Total Notes in System: {stats.totalNotesInSystem}</p>
                    <p>System Status: {stats.systemStatus}</p>
                </div>
            )}
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/callback" element={<Callback />} />
                    <Route path="/notes" element={<Notes />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
