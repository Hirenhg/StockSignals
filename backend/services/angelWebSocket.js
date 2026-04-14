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
let subscribedTokens = [];

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

function connectWebSocket(tokens = []) {
    if (!feedToken || !process.env.ANGEL_CLIENT_CODE) {
        return;
    }

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
        if (tokens.length > 0) {
            subscribeToTokens(tokens);
        }
    });

    ws.on('message', (data) => {
        try {
            const message = data.toString();
            
            try {
                JSON.parse(message);
                return;
            } catch (e) {
            }
            
            const buffer = Buffer.from(data);
            
            if (buffer.length < 2) return;
            
            let offset = 0;
            while (offset < buffer.length) {
                if (offset + 8 > buffer.length) break;
                
                const token = buffer.readUInt32BE(offset);
                const flag = buffer[offset + 4];
                
                if (flag === 1) {
                    if (offset + 12 > buffer.length) break;
                    const ltp = buffer.readUInt32BE(offset + 8) / 100;
                    
                    liveData[token.toString()] = {
                        ltp: ltp,
                        timestamp: Date.now()
                    };
                    offset += 12;
                } else {
                    offset += 8;
                }
            }
        } catch (err) {
            console.error('Parse error:', err.message);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
    });

    ws.on('close', () => {
        setTimeout(() => connectWebSocket(subscribedTokens), 5000);
    });
}

function subscribeToTokens(tokens) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    subscribedTokens = tokens;
    const subscribeMessage = {
        correlationID: "options_" + Date.now(),
        action: 1,
        params: {
            mode: 1,
            tokenList: [
                { exchangeType: 2, tokens: tokens.map(t => t.toString()) }
            ]
        }
    };
    ws.send(JSON.stringify(subscribeMessage));
}

async function initializeWebSocket(tokens = []) {
    const success = await getAngelSession();
    if (success) {
        connectWebSocket(tokens);
    }
}

function getLiveData() {
    return liveData;
}

function updateSubscription(tokens) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        subscribeToTokens(tokens);
    }
}

module.exports = { initializeWebSocket, getLiveData, updateSubscription };
