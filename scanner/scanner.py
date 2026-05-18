import pandas as pd
import json
import os
from datetime import datetime

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# Load stock list
stocks = pd.read_csv("scanner/nifty500.csv")

results = []

# Path to your processed data from calculate.py
PROCESSED_DATA_DIR = "data/processed"

print(f"📊 Scanning stocks from {PROCESSED_DATA_DIR}")
print(f"📈 Total stocks in NIFTY 500: {len(stocks)}")

for index, row in stocks.iterrows():
    symbol = row["SYMBOL"]
    try:
        print(f"[{index+1}/{len(stocks)}] Scanning {symbol}...", end=" ")
        
        # Read the processed JSON file (created by calculate.py)
        json_path = os.path.join(PROCESSED_DATA_DIR, f"{symbol}.json")
        
        if not os.path.exists(json_path):
            print(f"❌ No processed data found")
            continue
        
        with open(json_path, 'r') as f:
            data = json.load(f)
        
        # Extract data from the JSON
        candles = data.get('candles', [])
        if len(candles) < 200:
            print(f"⚠️ Insufficient candles ({len(candles)}), skipping")
            continue
        
        # Get latest prices
        latest_close = data['latest_price']
        
        # Calculate change from previous day
        if len(candles) >= 2:
            prev_close = candles[-2]['close']
            change_pct = ((latest_close - prev_close) / prev_close) * 100
        else:
            change_pct = 0
        
        # Get latest high/low
        latest_high = candles[-1]['high']
        latest_low = candles[-1]['low']
        
        # Get EMAs from indicators (already calculated in your JSON)
        indicators = data.get('indicators', {})
        
        ema20 = indicators.get('EMA20', {}).get('value', latest_close)
        ema50 = indicators.get('EMA50', {}).get('value', latest_close)
        ema100 = indicators.get('EMA100', {}).get('value', latest_close)
        ema200 = indicators.get('EMA200', {}).get('value', latest_close)
        
        # ----- Score out of 100 based on sequence + symmetric gaps -----
        # Check if LTP > EMA20 > EMA50 > EMA100 > EMA200
        if latest_close > ema20 > ema50 > ema100 > ema200:
            gaps = [
                latest_close - ema20,
                ema20 - ema50,
                ema50 - ema100,
                ema100 - ema200
            ]
            # All gaps must be positive (already true from sequence)
            mean_gap = sum(gaps) / len(gaps)
            # Symmetry: how close each gap is to mean_gap
            deviations = [abs(g - mean_gap) for g in gaps]
            max_deviation = max(deviations)
            # If max_deviation is 0, perfect symmetry. Else normalize.
            # Score = 100 * (1 - (max_deviation / mean_gap)) but clip to 0-100
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
        
        print(f"✅ Score: {score}, Price: {latest_close}, Trend: {trend}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

# Sort by score (higher = better symmetry + alignment)
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
    "top_10_stocks": results[:10],  # Top 10 highest scoring stocks
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
print(f"   Top stock: {results[0]['symbol']} with score {results[0]['score']}" if results else "   No stocks analyzed")
print(f"📁 Results saved to: data/results.json")
print("="*60)
