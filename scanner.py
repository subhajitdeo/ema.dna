"""
NSE Nifty 500 Trend Strength Scanner
Calculates EMAs, trend scores, and ranks stocks by bullish strength.
Outputs to data/results.json for frontend dashboard.
"""

import json
import time
import logging
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import pandas as pd
import yfinance as yf
import requests
from tqdm import tqdm

# ==================== CONFIGURATION ====================
SYMBOLS_FILE = "nifty500.txt"
OUTPUT_FILE = "data/results.json"
YEARS_OF_DATA = 3  # Minimum historical data required
REQUEST_DELAY = 0.3  # Seconds between stock fetches (rate limiting)
MAX_RETRIES = 3
RETRY_BACKOFF = 2  # Seconds

# Scoring weights (sum = 1.0)
WEIGHTS = {
    "ema_separation": 0.20,      # EMA20 vs EMA200 spread
    "price_distance": 0.25,      # Distance from EMA20
    "daily_gain": 0.20,          # Today's change %
    "relative_volume": 0.15,     # Volume surge
    "momentum": 0.20             # 5-day price change
}

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


# ==================== HELPER FUNCTIONS ====================
def load_symbols(file_path: str) -> List[str]:
    """Load NSE symbols from text file (one per line)."""
    try:
        with open(file_path, 'r') as f:
            symbols = [line.strip().upper() for line in f if line.strip()]
        logger.info(f"Loaded {len(symbols)} symbols from {file_path}")
        return symbols
    except FileNotFoundError:
        logger.error(f"Symbol file {file_path} not found!")
        return []


def fetch_stock_data(symbol: str, period: str = "3y") -> Optional[pd.DataFrame]:
    """
    Fetch daily OHLCV data for a given NSE symbol with retries.
    Adds '.NS' suffix for yfinance.
    """
    ticker = f"{symbol}.NS"
    for attempt in range(MAX_RETRIES):
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period=period, interval="1d", auto_adjust=False)
            
            if df.empty or len(df) < 200:  # Need at least 200 days for EMA200
                logger.warning(f"{symbol}: Insufficient data ({len(df)} days)")
                return None
                
            # Ensure we have standard columns
            df = df[['Open', 'High', 'Low', 'Close', 'Volume']].copy()
            df.sort_index(inplace=True)
            return df
            
        except Exception as e:
            logger.warning(f"{symbol} attempt {attempt+1}/{MAX_RETRIES} failed: {str(e)[:100]}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_BACKOFF * (attempt + 1))
            else:
                logger.error(f"{symbol}: All retries exhausted")
    return None


def calculate_emas(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate EMAs 20, 50, 100, 200."""
    df = df.copy()
    df['EMA20'] = df['Close'].ewm(span=20, adjust=False).mean()
    df['EMA50'] = df['Close'].ewm(span=50, adjust=False).mean()
    df['EMA100'] = df['Close'].ewm(span=100, adjust=False).mean()
    df['EMA200'] = df['Close'].ewm(span=200, adjust=False).mean()
    return df


def compute_metrics(df: pd.DataFrame, symbol: str) -> Optional[Dict]:
    """
    Extract latest metrics and compute advanced trend indicators.
    Returns dict with all required fields or None if insufficient data.
    """
    if df is None or df.empty:
        return None
    
    df = calculate_emas(df)
    latest = df.iloc[-1]
    
    # Check for NaN in critical EMAs
    if any(pd.isna(latest[ema]) for ema in ['EMA20', 'EMA50', 'EMA100', 'EMA200']):
        logger.debug(f"{symbol}: Missing EMA values")
        return None
    
    # Get previous close for daily gain
    prev_close = df['Close'].iloc[-2] if len(df) > 1 else latest['Close']
    daily_gain_pct = ((latest['Close'] - prev_close) / prev_close) * 100
    
    # Relative volume (20-day average vs today)
    vol_series = df['Volume'].iloc[-21:-1]  # Last 20 days excluding today
    avg_volume_20 = vol_series.mean() if len(vol_series) >= 10 else latest['Volume']
    rel_volume = latest['Volume'] / avg_volume_20 if avg_volume_20 > 0 else 1.0
    
    # EMA separation: (EMA20 - EMA200) as % of EMA200
    ema_sep_pct = ((latest['EMA20'] - latest['EMA200']) / latest['EMA200']) * 100
    
    # Price distance from EMA20 (%)
    price_dist_pct = ((latest['Close'] - latest['EMA20']) / latest['EMA20']) * 100
    
    # Momentum quality: 5-day price change
    if len(df) >= 6:
        close_5d_ago = df['Close'].iloc[-6]
        momentum_pct = ((latest['Close'] - close_5d_ago) / close_5d_ago) * 100
    else:
        momentum_pct = daily_gain_pct  # fallback
    
    # Bullish alignment condition
    is_bullish = (
        latest['Close'] > latest['EMA20'] > latest['EMA50'] > latest['EMA100'] > latest['EMA200']
    )
    
    return {
        "symbol": symbol,
        "price": round(latest['Close'], 2),
        "ema20": round(latest['EMA20'], 2),
        "ema50": round(latest['EMA50'], 2),
        "ema100": round(latest['EMA100'], 2),
        "ema200": round(latest['EMA200'], 2),
        "daily_gain_pct": round(daily_gain_pct, 2),
        "volume": int(latest['Volume']),
        "rel_volume": round(rel_volume, 2),
        "ema_sep_pct": round(ema_sep_pct, 2),
        "price_dist_pct": round(price_dist_pct, 2),
        "momentum_pct": round(momentum_pct, 2),
        "is_bullish_aligned": is_bullish
    }


def normalize_metric(values: List[float]) -> List[float]:
    """
    Min-max normalization with outlier clipping (5th-95th percentile).
    Returns values between 0 and 1.
    """
    if not values or len(values) < 2:
        return [0.5] * len(values)
    
    # Clip outliers
    lower = max(min(values), pd.Series(values).quantile(0.05))
    upper = min(max(values), pd.Series(values).quantile(0.95))
    
    if upper <= lower:
        return [0.5] * len(values)
    
    normalized = [(v - lower) / (upper - lower) for v in values]
    # Clamp to [0,1]
    return [max(0.0, min(1.0, n)) for n in normalized]


def calculate_trend_scores(stocks_data: List[Dict]) -> List[Dict]:
    """
    Add normalized trend strength score (0-100) to each stock.
    Higher score = stronger bullish momentum.
    """
    if not stocks_data:
        return []
    
    # Extract metric lists for normalization
    metrics = {
        "ema_sep_pct": [],
        "price_dist_pct": [],
        "daily_gain_pct": [],
        "rel_volume": [],
        "momentum_pct": []
    }
    
    for stock in stocks_data:
        for key in metrics.keys():
            metrics[key].append(stock.get(key, 0))
    
    # Normalize each metric across all stocks
    normalized_metrics = {}
    for key, values in metrics.items():
        normalized_metrics[key] = normalize_metric(values)
    
    # Compute final weighted score
    for idx, stock in enumerate(stocks_data):
        score = 0.0
        for metric, weight in WEIGHTS.items():
            norm_val = normalized_metrics[metric][idx]
            score += norm_val * weight
        
        stock["trend_score"] = round(score * 100, 1)  # 0-100 scale
        # Determine color status based on score and alignment
        if stock.get("is_bullish_aligned", False) and stock["trend_score"] >= 60:
            stock["status"] = "Strong Bullish"
            stock["color"] = "green"
        elif stock.get("is_bullish_aligned", False):
            stock["status"] = "Bullish"
            stock["color"] = "green"
        elif stock["trend_score"] >= 50:
            stock["status"] = "Neutral"
            stock["color"] = "yellow"
        else:
            stock["status"] = "Weak"
            stock["color"] = "red"
    
    # Sort by trend_score descending
    stocks_data.sort(key=lambda x: x["trend_score"], reverse=True)
    
    # Add rank
    for rank, stock in enumerate(stocks_data, 1):
        stock["rank"] = rank
    
    return stocks_data


# ==================== MAIN SCANNER ====================
def run_scanner():
    """Main execution: fetch all NSE symbols, compute metrics, save JSON."""
    start_time = datetime.now()
    logger.info("Starting NSE Nifty 500 Trend Strength Scanner")
    
    # Load symbols
    symbols = load_symbols(SYMBOLS_FILE)
    if not symbols:
        logger.error("No symbols loaded. Exiting.")
        sys.exit(1)
    
    # Fetch data for each symbol
    all_stocks_data = []
    failed_symbols = []
    
    for symbol in tqdm(symbols, desc="Scanning stocks"):
        # Throttle requests
        time.sleep(REQUEST_DELAY)
        
        df = fetch_stock_data(symbol, period=f"{YEARS_OF_DATA}y")
        if df is None:
            failed_symbols.append(symbol)
            continue
        
        metrics = compute_metrics(df, symbol)
        if metrics:
            all_stocks_data.append(metrics)
        else:
            failed_symbols.append(symbol)
    
    logger.info(f"Successfully processed: {len(all_stocks_data)} stocks")
    logger.info(f"Failed/Insufficient: {len(failed_symbols)} stocks")
    
    if not all_stocks_data:
        logger.error("No valid stock data. Exiting.")
        sys.exit(1)
    
    # Calculate trend scores and rankings
    ranked_stocks = calculate_trend_scores(all_stocks_data)
    
    # Count bullish aligned
    bullish_count = sum(1 for s in ranked_stocks if s.get("is_bullish_aligned", False))
    
    # Prepare final JSON output
    output = {
        "last_updated": datetime.now().isoformat(),
        "last_updated_readable": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
        "total_stocks_scanned": len(symbols),
        "successful_stocks": len(ranked_stocks),
        "bullish_count": bullish_count,
        "failed_count": len(failed_symbols),
        "scanner_duration_seconds": round((datetime.now() - start_time).total_seconds(), 1),
        "stocks": ranked_stocks
    }
    
    # Save to JSON file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=2)
    
    logger.info(f"Results saved to {OUTPUT_FILE}")
    logger.info(f"Top 5 bullish stocks: {[s['symbol'] for s in ranked_stocks[:5] if s.get('is_bullish_aligned')]}")
    
    # Print summary
    print("\n" + "="*50)
    print("SCAN COMPLETE")
    print(f"Total processed: {len(ranked_stocks)}")
    print(f"Bullish aligned: {bullish_count}")
    print(f"Average trend score: {sum(s['trend_score'] for s in ranked_stocks)/len(ranked_stocks):.1f}")
    print(f"Time taken: {output['scanner_duration_seconds']} seconds")
    print("="*50)


if __name__ == "__main__":
    run_scanner()
