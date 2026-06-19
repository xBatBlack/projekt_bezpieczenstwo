import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('access_token') || null);

    const login = (newToken) => {
        setToken(newToken);
        localStorage.setItem('access_token', newToken);
    };

    const logout = () => {
        setToken(null);
        localStorage.removeItem('access_token');
        // Also clear PKCE verifier just in case
        localStorage.removeItem('code_verifier');
    };

    return (
        <AuthContext.Provider value={{ token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
