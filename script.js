// script.js

const stocks = [
{
    symbol:"RELIANCE",
    company:"Reliance Industries Ltd.",
    price:2520.40,
    change:1.82,
    ema20:2512.30,
    ema50:2493.70,
    ema100:2458.20,
    ema200:2405.90,
    low:2420,
    high:2545
},
{
    symbol:"TCS",
    company:"Tata Consultancy Services",
    price:3650.00,
    change:-0.72,
    ema20:3672.50,
    ema50:3661.80,
    ema100:3625.40,
    ema200:3580.20,
    low:3605,
    high:3705
}
];

const container = document.getElementById("stockContainer");

function createCard(stock){

    const positive = stock.change >= 0;

    const card = document.createElement("div");

    card.className = "stock-card";

    card.innerHTML = `

    <div class="left-section">

        <div>
            <div class="stock-name">${stock.symbol}</div>
            <div class="company">${stock.company}</div>
        </div>

        <div class="price-row">

            <div class="price">
                ₹${stock.price.toLocaleString()}
            </div>

            <div class="change ${positive ? "positive":"negative"}">
                ${positive ? "+" : ""}${stock.change}%
            </div>

        </div>

        <div class="ema-values">

            <div class="ema-box">
                <div class="ema-label ema20">E20</div>
                <div class="ema-price">${stock.ema20}</div>
            </div>

            <div class="ema-box">
                <div class="ema-label ema50">E50</div>
                <div class="ema-price">${stock.ema50}</div>
            </div>

            <div class="ema-box">
                <div class="ema-label ema100">E100</div>
                <div class="ema-price">${stock.ema100}</div>
            </div>

            <div class="ema-box">
                <div class="ema-label ema200">E200</div>
                <div class="ema-price">${stock.ema200}</div>
            </div>

        </div>

    </div>

    <div class="middle-section">

        <div class="section-title">
            EMA STRUCTURE
        </div>

        <div class="line-area">

            <div class="base-line"></div>

            <div class="circle c200" style="left:8%"></div>

            <div class="circle c100" style="left:38%"></div>

            <div class="circle c50" style="left:68%"></div>

            <div class="circle c20" style="left:92%"></div>

            <div class="triangle" style="left:98%"></div>

        </div>

    </div>

    <div class="right-section">

        <div class="section-title">
            DAY RANGE
        </div>

        <div class="line-area">

            <div class="base-line"></div>

            <div class="range-dot low"></div>

            <div class="range-dot high"></div>

            <div class="triangle" style="left:70%"></div>

        </div>

        <div class="range-labels">

            <span>
                ${stock.low}
                <div class="low-text">LOW</div>
            </span>

            <span style="text-align:right">
                ${stock.high}
                <div class="high-text">HIGH</div>
            </span>

        </div>

    </div>

    `;

    container.appendChild(card);
}

stocks.forEach(createCard);
