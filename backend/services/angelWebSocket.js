const { SmartAPI } = require("smartapi-javascript");
const { TOTP } = require("totp-generator");
const WebSocket = require('ws');

const smart_api = new SmartAPI({
    api_key: process.env.ANGEL_API_KEY,
});

let sessionToken = null;
let feedToken = null;
let ws = null;
let liveData = {};

async function getAngelSession() {
    try {
        const totpResult = await TOTP.generate(process.env.ANGEL_TOTP_SECRET.replace(/\s/g, ''));
        const otp = totpResult.otp;
        
        const session = await smart_api.generateSession(
            process.env.ANGEL_CLIENT_CODE,
            process.env.ANGEL_PASSWORD,
            otp
        );

        if (session.status) {
            sessionToken = session.data.jwtToken;
            feedToken = session.data.feedToken;
            smart_api.setAccessToken(sessionToken);
            return true;
        }
    } catch (error) {
        console.error("Session error:", error.message);
    }
    return false;
}

function connectWebSocket() {
    if (!feedToken || !process.env.ANGEL_CLIENT_CODE) return;

    const wsUrl = 'wss://smartapisocket.angelone.in/smart-stream';
    ws = new WebSocket(wsUrl, {
        headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'x-api-key': process.env.ANGEL_API_KEY,
            'x-client-code': process.env.ANGEL_CLIENT_CODE,
            'x-feed-token': feedToken
        }
    });

    ws.on('open', () => {
        subscribeToTokens();
    });

    ws.on('message', (data) => {
        try {
            const buffer = Buffer.from(data);
            if (buffer.length > 2) {
                const token = buffer.readUInt32BE(0).toString();
                const ltp = buffer.readUInt32BE(4) / 100;
                
                liveData[token] = {
                    ltp: ltp,
                    volume: null,
                    oi: null
                };
            }
        } catch (err) {
            console.error('Parse error:', err.message);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
    });

    ws.on('close', () => {
        setTimeout(connectWebSocket, 5000);
    });
}

function subscribeToTokens() {
    // Subscribe to NIFTY and BANKNIFTY spot
    const subscribeMessage = {
        correlationID: "abc123",
        action: 1,
        params: {
            mode: 1,
            tokenList: [
                { exchangeType: 1, tokens: ["99926000", "99926009"] }
            ]
        }
    };
    ws.send(JSON.stringify(subscribeMessage));
}

async function initializeWebSocket() {
    const success = await getAngelSession();
    if (success) {
        connectWebSocket();
    }
}

function getLivePrice(token) {
    return liveData[token] || null;
}

module.exports = { initializeWebSocket, getLivePrice };
