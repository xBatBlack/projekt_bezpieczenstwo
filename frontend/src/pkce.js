export const generateRandomString = (length = 64) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
    }
    return result;
};

export const generateCodeChallenge = async (codeVerifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    
    // Base64Url encoding
    const hashArray = Array.from(new Uint8Array(digest));
    const hashString = hashArray.map(b => String.fromCharCode(b)).join('');
    const base64 = btoa(hashString);
    
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
