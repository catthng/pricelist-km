/********************************************
 * Utility Functions
 ********************************************/
function toNumber(str) {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ""), 10) || 0;
}

function formatNumber(value) {
  const numericValue = toNumber(value);
  return numericValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/********************************************
 * DOM References
 ********************************************/
const statusMessage = document.getElementById("status-message");
const dataInfo = document.getElementById("data-info");
const searchInput = document.getElementById("search-input");
const resultsDiv = document.getElementById("results");
const refreshBtn = document.getElementById("refresh-btn");
const barcodeBtn = document.getElementById("barcode-btn");
const scannerModal = document.getElementById("scanner-modal");
const closeModal = document.getElementById("close-modal");

// Detail modal references
const detailModal = document.getElementById("detail-modal");
const closeDetailModal = document.getElementById("close-detail-modal");
const detailContainer = document.getElementById("detail-container");

/********************************************
 * Data Initialization
 ********************************************/
let pricelistData = JSON.parse(localStorage.getItem("pricelistData") || "[]");
let dataCount = localStorage.getItem("pricelistDataCount") || 0;
let lastUpdated = localStorage.getItem("pricelistLastUpdated") || "N/A";

// Update data info with a simpler format: e.g., "Items: 1475. Updated: 3/18/25"
function updateDataInfo(count, updatedTime) {
  const datePart = new Date(updatedTime).toLocaleDateString();
  dataInfo.textContent = `Items: ${count}. Updated: ${datePart}`;
}

updateDataInfo(dataCount, lastUpdated);

/********************************************
 * Refresh Data Functionality
 ********************************************/
refreshBtn.addEventListener("click", refreshData);

function refreshData() {
  statusMessage.textContent = "Starting data refresh...";
  const sheetUrl = "https://docs.google.com/spreadsheets/d/1hCqLjZ8KcOV8sR9Q65mltuUwYLcuGmKsuN2HZz5Ig1o/export?format=csv";
  
  fetch(sheetUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error("Network response was not OK");
      }
      statusMessage.textContent = "Downloading CSV from Google Sheets...";
      return response.text();
    })
    .then(csvData => {
      statusMessage.textContent = "Parsing CSV...";
      const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
      
      pricelistData = parsed.data;
      const rowCount = pricelistData.length;
      const nowString = new Date().toLocaleString();

      localStorage.setItem("pricelistData", JSON.stringify(pricelistData));
      localStorage.setItem("pricelistDataCount", rowCount);
      localStorage.setItem("pricelistLastUpdated", nowString);

      statusMessage.textContent = `Data refreshed successfully. ${rowCount} rows loaded on ${nowString}.`;
      updateDataInfo(rowCount, nowString);
    })
    .catch(error => {
      statusMessage.textContent = "Error refreshing data: " + error;
    });
}

/********************************************
 * Search Functionality
 ********************************************/
searchInput.addEventListener("input", (e) => {
  performSearch(e.target.value);
});

function performSearch(query) {
  if (!pricelistData || !query) {
    resultsDiv.innerHTML = "";
    return;
  }
  query = query.toLowerCase();
  
  const filtered = pricelistData.filter(item => {
    const barcode = (item["Barcode"] || "").toLowerCase();
    const itemCode = (item["Item Code"] || "").toLowerCase();
    const itemName = (item["Item Name"] || "").toLowerCase();
    return barcode.includes(query) || itemCode.includes(query) || itemName.includes(query);
  }).slice(0, 30);
  
  renderResults(filtered);
}

function renderResults(results) {
  resultsDiv.innerHTML = "";
  results.forEach(item => {
    const retail = formatNumber(item["Retail Price"]);
    const net = formatNumber(item["Net Price"]);
    const discountRaw = toNumber(item["Discount %"]);
    const discount = discountRaw.toLocaleString('en-US', { maximumFractionDigits: 0 });
    
    const div = document.createElement("div");
    div.classList.add("result-item");
    
    const row1 = document.createElement("div");
    row1.classList.add("line1");
    row1.textContent = item["Item Name"] || "";
    
    const row2 = document.createElement("div");
    row2.classList.add("line2");
    row2.innerHTML = `<span>Code: ${item["Item Code"] || ""}</span><span>${item["Barcode"] || ""}</span>`;
    
    const row3 = document.createElement("div");
    row3.classList.add("line3");
    row3.textContent = `Retail: ${retail} | Disc : ${discount}% | Net: ${net}`;
    
    div.appendChild(row1);
    div.appendChild(row2);
    div.appendChild(row3);
    
    // When a result is clicked, show the detail pop-up
    div.addEventListener("click", () => {
      showDetail(item);
    });
    
    resultsDiv.appendChild(div);
  });
}

/********************************************
 * Detail Modal Functionality
 ********************************************/
function showDetail(item) {
  const retail = formatNumber(item["Retail Price"]);
  const net = formatNumber(item["Net Price"]);
  const discountRaw = toNumber(item["Discount %"]);
  const discount = discountRaw.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const imageUrl = item["Item Code"] ? `https://filedn.eu/lOjLpzJofleJiC3OIhcsQL0/ERPThumbnails/${item["Item Code"]}.jpg` : "";
  
  const imageMarkup = imageUrl ? `<div class="detail-image"><img src="${imageUrl}" alt="${item["Item Name"]} Thumbnail" /></div>` : "";
  
  detailContainer.innerHTML = `
    <div class="detail-info">
      ${imageMarkup}
      <div class="detail-text">
        <h2>${item["Item Name"] || ""}</h2>
        <p><strong>Item Code:</strong> ${item["Item Code"] || ""}</p>
        <p><strong>Barcode:</strong> ${item["Barcode"] || ""}</p>
        <p><strong>Retail:</strong> ${retail}</p>
        <p><strong>Disc :</strong> ${discount}%</p>
        <p><strong>Net:</strong> <span class="net-price">${net}</span></p>
      </div>
    </div>
  `;
  
  detailModal.style.display = "flex";
}

closeDetailModal.addEventListener("click", () => {
  detailModal.style.display = "none";
});
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) {
    detailModal.style.display = "none";
  }
});

/********************************************
 * ZXing Barcode Scanner Functionality
 ********************************************/
let codeReader; // Global instance of ZXing code reader

// Ensure the scanner modal is hidden on page load
document.addEventListener("DOMContentLoaded", () => {
  scannerModal.style.display = "none";
});

barcodeBtn.addEventListener("click", () => {
  // Show the scanner modal only when the user clicks the button
  scannerModal.style.display = "flex";
  
  // Initialize the ZXing reader
  codeReader = new ZXing.BrowserMultiFormatReader();
  console.log("ZXing code reader initialized");
  
  // Start decoding from the default video device; the video element id is "scanner-video"
  codeReader.decodeFromVideoDevice(null, 'scanner-video', (result, err) => {
    if (result) {
      onDetectedHandler(result.text);
    }
    if (err && !(err instanceof ZXing.NotFoundException)) {
      console.error(err);
    }
  });
});

function onDetectedHandler(scannedText) {
  stopScanner();
  searchInput.value = scannedText;
  performSearch(scannedText);
}

closeModal.addEventListener("click", stopScanner);

function stopScanner() {
  if (codeReader) {
    codeReader.reset();
    codeReader = null;
  }
  scannerModal.style.display = "none";
}
