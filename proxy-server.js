// Simple Proxy Server for GitHub Pages
// Save as proxy-server.js and run with: node proxy-server.js

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Your API endpoints
const API_ENDPOINTS = {
    tcpa: 'https://api.uspeoplesearch.net/tcpa/v1',
    person: 'https://api.uspeoplesearch.net/person/v3',
    premium: 'https://premium_lookup-1-h4761841.deta.app/person',
    report: 'https://api.uspeoplesearch.net/tcpa/report'
};

// Proxy endpoint
app.get('/api/check', async (req, res) => {
    try {
        const { number, endpoint } = req.query;
        
        if (!number) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        
        let targetUrl;
        switch(endpoint) {
            case 'tcpa':
                targetUrl = `${API_ENDPOINTS.tcpa}?x=${encodeURIComponent(number)}`;
                break;
            case 'person':
                targetUrl = `${API_ENDPOINTS.person}?x=${encodeURIComponent(number)}`;
                break;
            case 'premium':
                targetUrl = `${API_ENDPOINTS.premium}?x=${encodeURIComponent(number)}`;
                break;
            default:
                targetUrl = `${API_ENDPOINTS.tcpa}?x=${encodeURIComponent(number)}`;
        }
        
        console.log(`Proxying request to: ${targetUrl}`);
        
        const response = await axios.get(targetUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'DNC-Checker-Proxy/1.0'
            }
        });
        
        res.json(response.data);
        
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ 
            error: 'Proxy error', 
            message: error.message 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Proxy server running on port ${PORT}`);
    console.log(`📞 Endpoint: http://localhost:${PORT}/api/check?number=+12345678901`);
});

// For Render.com deployment
module.exports = app;
