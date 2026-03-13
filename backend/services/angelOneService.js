const { SmartAPI } = require("smartapi-javascript");
const { TOTP } = require("totp-generator");

const smart_api = new SmartAPI({
    api_key: process.env.ANGEL_API_KEY,
});

let sessionToken = null;
let sessionExpiry = 0;

async function getAngelSession() {
    const now = Date.now();
    if (sessionToken && now < sessionExpiry) return sessionToken;

    try {
        const secret = process.env.ANGEL_TOTP_SECRET.replace(/\s/g, '');
        const totpResult = await TOTP.generate(secret);
        const otp = totpResult.otp;

        const session = await smart_api.generateSession(
            process.env.ANGEL_CLIENT_CODE, 
            process.env.ANGEL_PASSWORD, 
            otp
        );

        if (session.status) {
            sessionToken = session.data.jwtToken;
            smart_api.setAccessToken(sessionToken);
            sessionExpiry = now + 3600000;
            return sessionToken;
        }
    } catch (error) {
        console.error("Session error:", error.message);
    }
    return null;
}

async function getAngelOptionData(tokenList) {
    try {
        const token = await getAngelSession();
        if (!token || !tokenList || tokenList.length === 0) return [];

        const params = {
            mode: "FULL",
            exchangeTokens: { "NFO": tokenList }
        };
        
        const marketData = await smart_api.marketData(params);

        if (marketData.status && marketData.data && marketData.data.fetched) {
            return marketData.data.fetched;
        }
    } catch (error) {
        console.error("Market Data Error:", error.message);
    }
    return [];
}

module.exports = { getAngelOptionData, getAngelSession };