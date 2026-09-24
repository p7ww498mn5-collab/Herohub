const express = require('express');
const cors = require('cors');
const { put, list } = require('@vercel/blob');

const app = express();
const API_KEY = process.env.API_KEY;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ═══════ تخزين البيانات ═══════
const BLOB_PATH = 'hero-hub-data.json';

async function loadDB() {
    try {
        const { blobs } = await list({ prefix: BLOB_PATH });
        if (blobs.length === 0) return {};
        const res = await fetch(blobs[0].url);
        if (!res.ok) return {};
        return await res.json();
    } catch (e) {
        console.error('DB load error:', e.message);
        return {};
    }
}

async function saveDB(data) {
    try {
        await put(BLOB_PATH, JSON.stringify(data), {
            access: 'public',
            addRandomSuffix: false,
            allowOverwrite: true,
        });
    } catch (e) {
        console.error('DB save error:', e.message);
    }
}

// ═══════ التحقق من API Key ═══════
function checkAuth(req, res, next) {
    const key = req.headers['x-api-key'] ||
                (req.headers['authorization'] || '').replace('Bearer ', '');
    if (!API_KEY || key !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// ═══════ استقبال البيانات من السكربت ═══════
app.post('/api/player/stats', checkAuth, async (req, res) => {
    const data = req.body;
    if (!data || !data.userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    let database = await loadDB();
    const id = String(data.userId);
    const existing = database[id] || {};

    database[id] = {
        userId: id,
        username: data.username || existing.username || 'Unknown',
        level: data.level != null ? data.level : (existing.level || 0),
        cash: data.cash != null ? data.cash : (existing.cash || 0),
        bank: data.bank != null ? data.bank : (existing.bank || 0),
        vehicles: Array.isArray(data.vehicles) ? data.vehicles : (existing.vehicles || []),
        lastSeen: Date.now(),
    };

    await saveDB(database);
    res.json({ ok: true });
});

// ═══════ إرجاع كل الحسابات ═══════
app.get('/api/players', async (req, res) => {
    const database = await loadDB();
    const list = Object.values(database).map(p => ({
        ...p,
        online: (Date.now() - p.lastSeen) < 30000,
    }));
    list.sort((a, b) => b.lastSeen - a.lastSeen);
    res.json(list);
});

module.exports = app;
