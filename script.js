async function loadData() {

    const response = await fetch("data/results.json");

    const result = await response.json();

    const stocks = result.data;

    document.getElementById("lastUpdated").innerHTML =
        "Last Updated: " + result.last_updated;

    const tableBody = document.getElementById("tableBody");

    tableBody.innerHTML = "";

    stocks.forEach((stock, index) => {

        const trendClass = stock.bullish
            ? "green"
            : "red";

        const trendText = stock.bullish
            ? "BULLISH"
            : "WEAK";

        const row = `
            <tr>
                <td>${index + 1}</td>
                <td>${stock.symbol}</td>
                <td>${stock.price}</td>
                <td>${stock.ema20}</td>
                <td>${stock.ema50}</td>
                <td>${stock.ema100}</td>
                <td>${stock.ema200}</td>
                <td>${stock.score}</td>
                <td class="${trendClass}">
                    ${trendText}
                </td>
            </tr>
        `;

        tableBody.innerHTML += row;
    });

    setupSearch();
}

function setupSearch() {

    const input = document.getElementById("searchInput");

    input.addEventListener("keyup", function () {

        const filter = input.value.toUpperCase();

        const rows = document.querySelectorAll("tbody tr");

        rows.forEach(row => {

            const stock =
                row.children[1].textContent;

            if (stock.toUpperCase().includes(filter)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }

        });

    });

}

loadData();
