require('dotenv').config();
const Web3 = require('web3');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WS_RPC_URL));
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const BURN_ADDRESS = process.env.BURN_ADDRESS;
const CHAT_ID = process.env.CHAT_ID;

const ABI = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "name": "from", "type": "address" },
            { "indexed": true, "name": "to", "type": "address" },
            { "indexed": false, "name": "value", "type": "uint256" }
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [{ "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    }
];

const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

async function getTotalSupply() {
    const totalSupply = await contract.methods.totalSupply().call();
    return web3.utils.fromWei(totalSupply, 'ether');  // Convert from Wei
}

async function getBurntTokens() {
    try {
        const balance = await contract.methods.balanceOf(BURN_ADDRESS).call();
        return web3.utils.fromWei(balance, 'ether');  // Convert from Wei
    } catch (error) {
        console.error("Error fetching burnt tokens:", error);
        return 0;
    }
}

async function listenForBurns() {
    console.log("🔥 Listening for burn transactions...");

    contract.events.Transfer({ fromBlock: 'latest' })
        .on('data', async (event) => {
            const { from, to, value } = event.returnValues;
            if (to.toLowerCase() === BURN_ADDRESS.toLowerCase()) {
                const burnedAmount = web3.utils.fromWei(value, 'ether');

                const totalSupply = await getTotalSupply();
                const burntTokens = await getBurntTokens();

                const percentBurnt = ((burntTokens / totalSupply) * 100).toFixed(2);
                const circulatingSupply = (totalSupply - burntTokens).toFixed(2);

                const message = `
🔥 **Burn Alert** 🔥
${burnedAmount} tokens were burnt! 🏴‍☠️
🔥 **% Burnt Till Now:** ${percentBurnt}%
💰 **Circulating Supply Left:** ${circulatingSupply} Tokens
`;

                await sendTelegramAlert(message);
            }
        })
        .on('error', console.error);
}

async function sendTelegramAlert(message) {
    try {
        const gifPath = "./burn.gif"; // Path to your local GIF file
        await bot.sendAnimation(CHAT_ID, fs.createReadStream(gifPath), { caption: message, parse_mode: "Markdown" });
    } catch (error) {
        console.error("Failed to send GIF:", error);
    }
}

listenForBurns();
console.log("🔥 Burn transaction bot is live...");
