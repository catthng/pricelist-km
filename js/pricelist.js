/********************************************
 * Utility functions
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
   * DOM references
   ********************************************/
  const statusMessage = document.getElementById("status-message");
  const dataInfo = document.getElementById("data-info");
  const searchInput = document.getElementById("search-input");
  const resultsDiv = document.getElementById("results");
  const refreshBtn = document.getElementById("refresh-btn");
  const barcodeBtn = document.getElementById("barcode-btn");
  const scannerModal = document.getElementById("scanner-modal");
  const closeModal = document.getElementById("close-modal");
  
  /********************************************
   * Load any existing localStorage data
   ********************************************/
  let pricelistData = JSON.parse(localStorage.getItem("pricelistData") || "[]");
  let dataCount = localStorage.getItem("pricelistDataCount") || 0;
  let lastUpdated = localStorage.getItem("pricelistLastUpdated") || "N/A";
  
  updateDataInfo(dataCount, lastUpdated);
  
  /********************************************
   * Refresh data (fetch from Google Sheets CSV)
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
  
        // Save to localStorage
        localStorage.setItem("pricelistData", JSON.stringify(pricelistData));
        localStorage.setItem("pricelistDataCount", rowCount);
        localStorage.setItem("pricelistLastUpdated", nowString);
  
        statusMessage.textContent = `Data refreshed successfully. ${rowCount} rows loaded on ${nowString}.`;
  
        dataCount = rowCount;
        lastUpdated = nowString;
        updateDataInfo(dataCount, lastUpdated);
      })
      .catch(error => {
        statusMessage.textContent = "Error refreshing data: " + error;
      });
  }
  
  function updateDataInfo(count, updatedTime) {
    dataInfo.textContent = `${count} items loaded. Last updated: ${updatedTime}`;
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
      return (
        barcode.includes(query) ||
        itemCode.includes(query) ||
        itemName.includes(query)
      );
    }).slice(0, 30); // limit to 30
    
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
      
      // Row 1: Item Name
      const row1 = document.createElement("div");
      row1.classList.add("line1");
      row1.textContent = item["Item Name"] || "";
      
      // Row 2: Code + Barcode
      const row2 = document.createElement("div");
      row2.classList.add("line2");
      row2.innerHTML = `
        <span>Code: ${item["Item Code"] || ""}</span>
        <span>${item["Barcode"] || ""}</span>
      `;
      
      // Row 3: Retail, Disc, Net
      const row3 = document.createElement("div");
      row3.classList.add("line3");
      row3.textContent = `Retail: ${retail} | Disc: ${discount}% | Net: ${net}`;
      
      div.appendChild(row1);
      div.appendChild(row2);
      div.appendChild(row3);
      
      resultsDiv.appendChild(div);
    });
  }
  
  /********************************************
   * Quagga2 Barcode Scanner Setup
   ********************************************/
  barcodeBtn.addEventListener("click", () => {
    // Show the modal
    scannerModal.style.display = "block";
    
    Quagga.init({
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: document.querySelector("#scanner-container"),
        constraints: {
          facingMode: "environment", // use the back camera
          width: { min: 1280 },
          height: { min: 720 },
          // Request manual focus. Note: Not all browsers support this.
          advanced: [{ focusMode: "manual", focusDistance: 0 }]
        }
      },
      frequency: 5,       // Process 5 frames per second
      locate: true,       // Actively locate the barcode in the image
      numOfWorkers: 4,    // Use 4 web workers for parallel processing
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader",
          "ean_8_reader",
          "upc_reader",
          "upc_e_reader",
          "code_39_reader",
          "codabar_reader",
          "i2of5_reader"
        ]
      }
    }, function(err) {
      if (err) {
        console.error("Quagga init error:", err);
        return;
      }
      Quagga.start();
      // Start periodic focus adjustment
      startFocusAdjustment();
    });
    
    Quagga.onDetected(onDetectedHandler);
  });
  
  // Periodically try to enforce focus constraints
  let focusIntervalId;
  function startFocusAdjustment() {
    // Clear any existing interval
    if (focusIntervalId) clearInterval(focusIntervalId);
    
    focusIntervalId = setInterval(() => {
      const track = Quagga.cameraAccess.getActiveTrack();
      if (track && track.applyConstraints) {
        track.applyConstraints({
          advanced: [{ focusMode: "manual", focusDistance: 0 }]
        }).catch(e => {
          console.warn("Focus adjustment not supported:", e);
        });
      }
    }, 500); // every 500ms
  }
  
  function stopFocusAdjustment() {
    if (focusIntervalId) {
      clearInterval(focusIntervalId);
      focusIntervalId = null;
    }
  }
  
  // Called when a barcode is detected
  function onDetectedHandler(data) {
    const scannedCode = data.codeResult.code;
    stopScanner();
    searchInput.value = scannedCode;
    performSearch(scannedCode);
  }
  
  closeModal.addEventListener("click", stopScanner);
  
  function stopScanner() {
    stopFocusAdjustment();
    Quagga.stop();
    Quagga.offDetected(onDetectedHandler);
    scannerModal.style.display = "none";
  }