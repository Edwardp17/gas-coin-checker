const axios = require('axios');
const ccxt = require('ccxt');

// You should store your API key in an environment variable for security
const API_KEY = process.env.API_KEY;
const API = 'https://api.etherscan.io/api';

async function etherscanGet(taskParams) {
    const params = { apikey: API_KEY, ...taskParams };
    try {
        const response = await axios.get(API, { params });
        return response.data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getBlock(blockDate) {
    const unixTs = Math.floor(blockDate.getTime() / 1000);
    const params = {
        module: 'block',
        action: 'getblocknobytime',
        timestamp: unixTs,
        closest: 'before',
    };
    return await etherscanGet(params);
}

async function getTxns(address, startDate, endDate) {
    const startBlock = (await getBlock(startDate)).result;
    const endBlock = (await getBlock(endDate)).result;
    const params = {
        module: 'account',
        action: 'txlist',
        address: address,
        startblock: startBlock,
        endblock: endBlock,
        sort: 'asc',
    };
    return (await etherscanGet(params)).result;
}

async function getHistoricalPrice(unixTsMs, pair, exchange, tf = '1m') {
    try {
        const price = await exchange.fetchOHLCV(pair, tf, unixTsMs, 50);
        return price[0][1];
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getCurrentPrice(pair) {
    const exchange = new ccxt.bybit();
    try {
        const ticker = await exchange.fetchTicker(pair);
        return ticker.last;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function parseTxn(txn, coin, exchange) {
    const unixTs = parseInt(txn.timeStamp);
    const txnFeeEth = (parseFloat(txn.gasPrice) / 1e9 * parseFloat(txn.gasUsed)) / 1e9;
    const ethPrice = await getHistoricalPrice(unixTs * 1000, 'ETH/USDT', exchange);

    if (!ethPrice) return null;

    const txnFeeUsd = parseFloat((txnFeeEth * ethPrice).toFixed(2));
    const coinPrice = await getHistoricalPrice(unixTs * 1000, coin, exchange);
    const coinPurchased = txnFeeUsd / coinPrice;

    return {
        txn_fee_eth: txnFeeEth,
        txn_fee_usd: txnFeeUsd,
        coin_purchased: coinPurchased,
    };
}

async function parseTxns(txns, coin) {
    const exchange = new ccxt.bybit();
    const results = await Promise.all(txns.map(txn => parseTxn(txn, coin, exchange)));
    return results.filter(x => x !== null);
}

async function main(address, startDt, endDt, coin) {
    const startDate = new Date(startDt);
    let endDate = new Date(endDt);

    // Check if the start date is greater than or equal to the end date
    if (startDate >= endDate) {
        return {
            invalid_request: "start date cannot be before or equal to end date",
        };
    }

    const currentDate = new Date();
    if (endDate >= currentDate) {
        endDate = currentDate;
    }

    const txns = await getTxns(address, startDate, endDate);
    const potentialCoinsDict = await parseTxns(txns, coin);

    const totalTxnFeeEth = potentialCoinsDict.reduce((acc, curr) => acc + curr.txn_fee_eth, 0);
    const totalTxnFeeUsd = potentialCoinsDict.reduce((acc, curr) => acc + curr.txn_fee_usd, 0).toFixed(2);
    const potentialCoins = potentialCoinsDict.reduce((acc, curr) => acc + curr.coin_purchased, 0).toFixed(2);
    const potentialCoinsUsd = (await getCurrentPrice(coin) * potentialCoins).toFixed(2);

    return `You spent ${totalTxnFeeEth} ETH or $${totalTxnFeeUsd} USD on ${potentialCoinsDict.length}, ETH transactions. Meanwhile, you could have bought ${potentialCoins} BONK which today would be worth..........$${potentialCoinsUsd} USD. cope.`;
}

// Express server setup and route handling to integrate with the frontend
const path = require('path');
const express = require('express');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const cors = require('cors');
app.use(cors());

app.post('/analyze', async (req, res) => {
    const { address, startDate, endDate} = req.body;
    if (!address || !startDate || !endDate) {
        return res.status(400).json({ invalid_request: "All fields are required" });
    }
    const coin = 'BONK/USDT'
    try {
        const result = await main(address, startDate, endDate, coin);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});