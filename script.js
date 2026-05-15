// NSE Trend Strength Dashboard - Frontend
let fullStockData = [];
let currentFilterBullish = false;
let currentSearchTerm = "";
let currentSortColumn = "rank";
let currentSortDirection = "asc";

// DOM elements
const tableBody = document.getElementById("tableBody");
const searchInput = document.getElementById("searchInput");
const filterBullishBtn = document.getElementById("filterBullishBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const refreshBtn = document.getElementById("refreshBtn");
const totalScannedSpan = document.getElementById("totalScanned");
const bullishCountSpan = document.getElementById("bullishCount");
const avgScoreSpan = document.getElementById("avgScore");
const lastUpdatedSpan = document.getElementById("lastUpdated");
const topStocksGrid = document.getElementById("topStocksGrid");
const bullishGrid = document.getElementById("bullishGrid");

// Helper: Format volume
function formatVolume(vol) {
    if (vol >= 1e7) return (vol / 1e7).toFixed(1) + "Cr";
    if (vol >= 1e5) return (vol / 1e5).toFixed(1) + "L";
    return vol.toLocaleString();
}

// Render summary cards
function renderSummary(data) {
    totalScannedSpan.innerText = data.successful_stocks || 0;
    bullishCountSpan.innerText = data.bullish_count || 0;
    const avg = data.stocks.reduce((sum, s) => sum + s.trend_score, 0) / (data.stocks.length || 1);
    avgScoreSpan.innerText = avg.toFixed(1);
    lastUpdatedSpan.innerText = data.last_updated_readable || "N/A";
}

// Render top 5 stocks
function renderTopStocks(stocks) {
    const top5 = stocks.slice(0, 5);
    topStocksGrid.innerHTML = top5.map(s => `
        <div class="top-card">
            <div class="symbol">${s.symbol}</div>
            <div class="score">${s.trend_score}</div>
            <div style="font-size:0.7rem; color:#9aa4bf;">Score</div>
            <div>₹${s.price}</div>
        </div>
    `).join('');
}

// Render bullish setups (aligned stocks sorted by score)
function renderBullishSetups(stocks) {
    const bullishStocks = stocks.filter(s => s.is_bullish_aligned === true).slice(0, 6);
    bullishGrid.innerHTML = bullishStocks.map(s => `
        <div class="top-card">
            <div class="symbol">${s.symbol}</div>
            <div class="score">+${s.daily_gain_pct}%</div>
            <div style="font-size:0.7rem;">EMA20: ₹${s.ema20}</div>
        </div>
    `).join('');
    if(bullishStocks.length === 0) bullishGrid.innerHTML = '<div class="top-card">No strong bullish setups currently</div>';
}

// Filter & sort data
function filterAndSortData() {
    let filtered = [...fullStockData];
    
    if (currentFilterBullish) {
        filtered = filtered.filter(s => s.is_bullish_aligned === true);
    }
    
    if (currentSearchTerm) {
        filtered = filtered.filter(s => s.symbol.toLowerCase().includes(currentSearchTerm.toLowerCase()));
    }
    
    // Sort
    filtered.sort((a, b) => {
        let aVal = a[currentSortColumn];
        let bVal = b[currentSortColumn];
        if (currentSortColumn === "symbol") {
            aVal = aVal || "";
            bVal = bVal || "";
            return currentSortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        aVal = aVal || 0;
        bVal = bVal || 0;
        if (currentSortDirection === "asc") return aVal - bVal;
        return bVal - aVal;
    });
    
    return filtered;
}

// Render table
function renderTable() {
    const filtered = filterAndSortData();
    if (!filtered.length) {
        tableBody.innerHTML = '<tr><td colspan="11">No stocks match criteria</td></tr>';
        return;
    }
    
    tableBody.innerHTML = filtered.map(s => `
        <tr>
            <td>${s.rank}</td>
            <td><strong>${s.symbol}</strong></td>
            <td>₹${s.price}</td>
            <td>₹${s.ema20}</td>
            <td>₹${s.ema50}</td>
            <td>₹${s.ema100}</td>
            <td>₹${s.ema200}</td>
            <td>${s.trend_score}</td>
            <td class="${s.daily_gain_pct >= 0 ? 'status-green' : 'status-red'}">${s.daily_gain_pct}%</td>
            <td>${formatVolume(s.volume)}</td>
            <td><span class="status-badge status-${s.color}">${s.status}</span></td>
        </tr>
    `).join('');
}

// Update UI completely
function updateDashboard(data) {
    fullStockData = data.stocks || [];
    renderSummary(data);
    renderTopStocks(fullStockData);
    renderBullishSetups(fullStockData);
    renderTable();
}

// Load data from JSON file
async function loadData() {
    tableBody.innerHTML = '<tr><td colspan="11"><div class="spinner"></div> Loading market data...</td></tr>';
    try {
        const response = await fetch('data/results.json?v=' + Date.now());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        updateDashboard(data);
    } catch (error) {
        console.error("Failed to load data:", error);
        tableBody.innerHTML = '<tr><td colspan="11">⚠️ Failed to load data. Please run scanner via GitHub Action first.</td></tr>';
    }
}

// Event listeners
searchInput.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value;
    renderTable();
});

filterBullishBtn.addEventListener('click', () => {
    currentFilterBullish = !currentFilterBullish;
    filterBullishBtn.classList.toggle('active', currentFilterBullish);
    renderTable();
});

resetFilterBtn.addEventListener('click', () => {
    currentFilterBullish = false;
    currentSearchTerm = "";
    searchInput.value = "";
    filterBullishBtn.classList.remove('active');
    renderTable();
});

refreshBtn.addEventListener('click', () => {
    loadData();
});

// Setup column sorting
document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.getAttribute('data-sort');
        if (currentSortColumn === column) {
            currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
        } else {
            currentSortColumn = column;
            currentSortDirection = "asc";
        }
        renderTable();
    });
});

// Initial load
loadData();
// Refresh every 5 minutes (optional)
setInterval(loadData, 300000);
