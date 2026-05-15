let fullData = [];
let filterBullish = false;
let searchTerm = "";
let sortCol = "rank", sortDir = "asc";

const tableBody = document.getElementById("tableBody");
const searchInput = document.getElementById("searchInput");
const filterBtn = document.getElementById("filterBullishBtn");
const resetBtn = document.getElementById("resetFilterBtn");
const refreshBtn = document.getElementById("refreshBtn");

function formatVolume(v) { if(v>=1e7) return (v/1e7).toFixed(1)+"Cr"; if(v>=1e5) return (v/1e5).toFixed(1)+"L"; return v.toLocaleString(); }

function renderSummary(data) {
    document.getElementById("totalScanned").innerText = data.successful_stocks || 0;
    document.getElementById("bullishCount").innerText = data.bullish_count || 0;
    const avg = data.stocks.reduce((s,stock)=>s+stock.trend_score,0)/(data.stocks.length||1);
    document.getElementById("avgScore").innerText = avg.toFixed(1);
    document.getElementById("lastUpdated").innerText = data.last_updated_readable || "N/A";
}

function renderTopStocks(stocks) {
    const top5 = stocks.slice(0,5);
    document.getElementById("topStocksGrid").innerHTML = top5.map(s=>`<div class="top-card"><div class="symbol">${s.symbol}</div><div class="score">${s.trend_score}</div><div style="font-size:0.7rem;">₹${s.price}</div></div>`).join('');
}

function renderBullish(stocks) {
    const bullish = stocks.filter(s=>s.is_bullish_aligned).slice(0,6);
    document.getElementById("bullishGrid").innerHTML = bullish.length ? bullish.map(s=>`<div class="top-card"><div class="symbol">${s.symbol}</div><div class="score">+${s.daily_gain_pct}%</div><div>EMA20: ₹${s.ema20}</div></div>`).join('') : '<div class="top-card">No strong bullish setups</div>';
}

function filterAndSort() {
    let filtered = [...fullData];
    if(filterBullish) filtered = filtered.filter(s=>s.is_bullish_aligned);
    if(searchTerm) filtered = filtered.filter(s=>s.symbol.toLowerCase().includes(searchTerm.toLowerCase()));
    filtered.sort((a,b)=>{
        let av = a[sortCol], bv = b[sortCol];
        if(sortCol==="symbol") return sortDir==="asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        av = av||0; bv = bv||0;
        return sortDir==="asc" ? av-bv : bv-av;
    });
    return filtered;
}

function renderTable() {
    const filtered = filterAndSort();
    if(!filtered.length) { tableBody.innerHTML = '<tr><td colspan="11">No stocks match</td></tr>'; return; }
    tableBody.innerHTML = filtered.map(s=>`
        <tr>
            <td>${s.rank}</td>
            <td><strong>${s.symbol}</strong></td>
            <td>₹${s.price}</td>
            <td>₹${s.ema20}</td>
            <td>₹${s.ema50}</td>
            <td>₹${s.ema100}</td>
            <td>₹${s.ema200}</td>
            <td>${s.trend_score}</td>
            <td class="${s.daily_gain_pct>=0?'positive-change':'negative-change'}">${s.daily_gain_pct}%</td>
            <td>${formatVolume(s.volume)}</td>
            <td><span class="status-badge status-${s.color}">${s.status}</span></td>
        </tr>
    `).join('');
}

async function loadData() {
    tableBody.innerHTML = '<tr><td colspan="11"><div class="spinner"></div> Loading...</td></tr>';
    try {
        const res = await fetch('data/results.json?v='+Date.now());
        if(!res.ok) throw new Error();
        const data = await res.json();
        fullData = data.stocks || [];
        renderSummary(data);
        renderTopStocks(fullData);
        renderBullish(fullData);
        renderTable();
    } catch(e) { tableBody.innerHTML = '<tr><td colspan="11">Failed to load data. Run GitHub Action first.</td></tr>'; }
}

searchInput.addEventListener('input', e=>{ searchTerm=e.target.value; renderTable(); });
filterBtn.addEventListener('click', ()=>{ filterBullish=!filterBullish; filterBtn.classList.toggle('active',filterBullish); renderTable(); });
resetBtn.addEventListener('click', ()=>{ filterBullish=false; searchTerm=""; searchInput.value=""; filterBtn.classList.remove('active'); renderTable(); });
refreshBtn.addEventListener('click', loadData);
document.querySelectorAll('th[data-sort]').forEach(th=>{
    th.addEventListener('click',()=>{
        const col = th.getAttribute('data-sort');
        if(sortCol===col) sortDir = sortDir==="asc"?"desc":"asc";
        else { sortCol=col; sortDir="asc"; }
        renderTable();
    });
});
loadData();
setInterval(loadData, 300000);
