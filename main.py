import datetime as dt

import requests
import time
import ccxt

from typing import Union
from multiprocessing import Pool, cpu_count
from functools import partial

import os

API_KEY = os.getenv('API_KEY')
API = 'https://api.etherscan.io/api'

def convert_unix(st: tuple):
    unix_ts = time.mktime(st)
    return int(unix_ts)


def etherscan_get(task_params: dict):
    params = {
        'apikey':API_KEY,
    }
    params.update(task_params)
    return requests.get(
        API,
        params,
        timeout=30
    )


def get_block(block_dt: Union[dt.date, dt.datetime]):
    date_tuple = block_dt.timetuple()
    unix_ts = convert_unix(date_tuple)
    params = {
        'module':'block',
        'action':'getblocknobytime',
        'timestamp':unix_ts,
        'closest':'before',
    }
    return etherscan_get(params).json()


def get_txns(address: str, start_dt: dt.date, end_dt: dt.datetime):
    start_block = get_block(start_dt)['result']
    end_block = get_block(end_dt)['result']
    params = {
        'module':'account',
        'action':'txlist',
        'address':address,
        'startblock': start_block,
        'endblock': end_block,
        'sort':'asc',
    }
    return etherscan_get(params).json()['result']


def get_historical_price(
        unix_ts_ms: int,
        pair: str,
        tf: str = '1m'
    ):
    exchange=ccxt.bybit()

    try:
        price = exchange.fetch_ohlcv(
            pair, tf, unix_ts_ms, 50
        )[0][1]
    except Exception as e:
        price = None
        print(e)
        print(f'No price available for {pair} at {unix_ts_ms}')
    return price

def get_current_price(pair):
    exchange = ccxt.bybit()
    return exchange.fetch_ticker(pair)['last']


def parse_txn(txn: dict[str,str], coin: str):
    unix_ts = int(txn['timeStamp'])
    txn_fee_eth = (float(txn['gasPrice']) / 1000000000 * float(txn['gasUsed'])) / 1000000000
    eth_price = get_historical_price(unix_ts*1000, 'ETH/USDT')

    if eth_price is None:
        return
    txn_fee_usd = round(txn_fee_eth * eth_price,2)
    coin_price = get_historical_price(unix_ts*1000, pair=coin)
    coin_purchased = txn_fee_usd / coin_price

    r_dict = {
        'txn_fee_eth': txn_fee_eth,
        'txn_fee_usd': txn_fee_usd,
        'coin_purchased': coin_purchased
    }

    return r_dict


def parse_txns(txns: list[dict[str,str]], coin: str):
    with Pool(cpu_count()) as pool:
        txns = pool.map(partial(parse_txn,coin=coin), txns)
    txns = [x for x in txns if x is not None]
    return txns, len(txns)


def main():
    start_date = dt.datetime(2023,1,20).date()
    end_date = dt.datetime.now()
    txns = get_txns(ADDRESS,start_date,end_date)
    potential_coins_dict, num_txns = parse_txns(txns, 'BONK/USDT')
    # print(potential_coins_dict)
    total_txn_fee_eth = sum([x['txn_fee_eth'] for x in potential_coins_dict])
    total_txn_fee_usd = sum([x['txn_fee_usd'] for x in potential_coins_dict])
    potential_coins = sum([x['coin_purchased'] for x in potential_coins_dict])
    potential_coins_usd = get_current_price('BONK/USDT') * potential_coins
    print(potential_coins, potential_coins_usd, total_txn_fee_eth, total_txn_fee_usd, num_txns)


if __name__ == '__main__':
    main()
