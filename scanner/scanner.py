import pandas as pd
import json
import os
import requests
from datetime import datetime

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# Load stock list
stocks = pd.read_csv("scanner/nifty500.csv")

# GitHub raw data URL
GITHUB_RAW_BASE = "https://raw.githubusercontent.com/subhajitdeo/shape.dna/main/data"

def fetch_stock_data(symbol):
    """Fetch stock data directly from GitHub"""
    url = f"{GITHUB_RAW_BASE}/{symbol}.NS.json"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except Exception as e:
        print(f"  Fetch error: {e}")
        return None

def parse_candles(data):
    """Parse Yahoo Finance JSON format into rows"""
    rows = []
    
    if isinstance(data, dict):
        result = data.get('chart', {}).get('result', [])
        if not result:
            return []
        quotes = result[0].get('indicators', {}).get('quote', [{}])[0]
        timestamps = result[0].get('timestamp', [])
        for i in range(len(timestamps)):
            o = quotes.get('open', [None])[i]
            h = quotes.get('high', [None])[i]
            l = quotes.get('low', [None])[i]
            c = quotes.get('close', [None])[i]
            v = quotes.get('volume', [None])[i]
            if None not in (o, h, l, c, v):
                rows.append({
                    'time': pd.Timestamp(timestamps[i], unit='s').strftime('%Y-%m-%d'),
                    'open': float(o), 'high': float(h), 'low': float(l),
                    'close': float(c), 'volume': int(v)
                })
    return rows

def calculate_ema(closes, period):
    """Calculate EMA"""
    if len(closes) < period:
        return closes[-1] if closes else 0
    alpha = 2 / (period + 1)
    result = [closes[0]]
    for val in closes[1:]:
        result.append(alpha * val + (1 - alpha) * result[-1])
    return result[-1]

results = []

print(f"📊 Scanning stocks from GitHub...")
print(f"📈 Total stocks in NIFTY 500: {len(stocks)}")

for index, row in stocks.iterrows():
    symbol = row["SYMBOL"]
    try:
        print(f"[{index+1}/{len(stocks)}] Scanning {symbol}...", end=" ")
        
        # Fetch data directly from GitHub
        data = fetch_stock_data(symbol)
        
        if not data:
            print(f"❌ No data found")
            continue
        
        # Parse candles
        candles = parse_candles(data)
        
        if len(candles) < 200:
            print(f"⚠️ Insufficient candles ({len(candles)}), skipping")
            continue
        
        # Get latest prices
        latest_close = candles[-1]['close']
        
        # Calculate change from previous day
        if len(candles) >= 2:
            prev_close = candles[-2]['close']
            change_pct = ((latest_close - prev_close) / prev_close) * 100
        else:
            change_pct = 0
        
        # Get latest high/low
        latest_high = candles[-1]['high']
        latest_low = candles[-1]['low']
        
        # Calculate EMAs
        closes = [c['close'] for c in candles]
        ema20 = calculate_ema(closes, 20)
        ema50 = calculate_ema(closes, 50)
        ema100 = calculate_ema(closes, 100)
        ema200 = calculate_ema(closes, 200)
        
        # ----- Score out of 100 based on sequence + symmetric gaps -----
        if latest_close > ema20 > ema50 > ema100 > ema200:
            gaps = [
                latest_close - ema20,
                ema20 - ema50,
                ema50 - ema100,
                ema100 - ema200
            ]
            mean_gap = sum(gaps) / len(gaps)
            deviations = [abs(g - mean_gap) for g in gaps]
            max_deviation = max(deviations)
            if mean_gap > 0:
                symmetry_score = max(0, 100 * (1 - (max_deviation / mean_gap)))
            else:
                symmetry_score = 0
        else:
            symmetry_score = 0
        
        score = round(symmetry_score, 2)
        
        # Determine trend strength
        if latest_close > ema200:
            trend = "BULLISH"
        elif latest_close < ema200:
            trend = "BEARISH"
        else:
            trend = "NEUTRAL"
        
        # Store results
        results.append({
            "symbol": symbol,
            "price": round(latest_close, 2),
            "change": round(change_pct, 2),
            "low": round(latest_low, 2),
            "high": round(latest_high, 2),
            "ema20": round(ema20, 2),
            "ema50": round(ema50, 2),
            "ema100": round(ema100, 2),
            "ema200": round(ema200, 2),
            "score": score,
            "trend": trend,
            "ema_alignment": "Perfect" if latest_close > ema20 > ema50 > ema100 > ema200 else "Partial"
        })
        
        print(f"✅ Score: {score}, Price: {latest_close}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

# Sort by score
results.sort(key=lambda x: x["score"], reverse=True)

# Add summary statistics
if results:
    avg_score = sum(r["score"] for r in results) / len(results)
    bullish_count = sum(1 for r in results if r["trend"] == "BULLISH")
    perfect_alignment = sum(1 for r in results if r["ema_alignment"] == "Perfect")
else:
    avg_score = 0
    bullish_count = 0
    perfect_alignment = 0

final_data = {
    "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "total_stocks_scanned": len(stocks),
    "total_stocks_analyzed": len(results),
    "statistics": {
        "average_score": round(avg_score, 2),
        "bullish_stocks": bullish_count,
        "bearish_stocks": len(results) - bullish_count,
        "perfect_ema_alignment": perfect_alignment
    },
    "top_10_stocks": results[:10],
    "data": results
}

with open("data/results.json", "w") as f:
    json.dump(final_data, f, indent=4)

print("\n" + "="*60)
print(f"✅ SCAN COMPLETED!")
print(f"   Total stocks in NIFTY 500: {len(stocks)}")
print(f"   Successfully analyzed: {len(results)}")
print(f"   Average score: {round(avg_score, 2)}")
print(f"   Bullish stocks: {bullish_count}")
print(f"   Perfect EMA alignment: {perfect_alignment}")
if results:
    print(f"   Top stock: {results[0]['symbol']} with score {results[0]['score']}")
print(f"📁 Results saved to: data/results.json")
print("="*60)
