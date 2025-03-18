// Utility: safely parse strings with commas, e.g. "125,000" -> 125000
function toNumber(str) {
    if (!str) return 0;
    return parseInt(str.replace(/,/g, ""), 10) || 0;
  }
  
  // Utility: format numbers as ###,### (no decimals)
  function formatNumber(value) {
    const numericValue = toNumber(value);
    return numericValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  
  // Global references
  const statusMessage = document.getElementById("status-message");
  const dataInfo = document.getElementById("data-info");
  const searchInput = document.getElementById("search-input");
  const resultsDiv = document.getElementById("results");
  const refreshBtn = document.getElementById("refresh-btn");
  const barcodeBtn = document.getElementById("barcode-btn");
  const scannerModal = document.getElementById("scanner-modal");
  const closeModal = document.getElementById("close-modal");
  const cameraSelection = document.getElementById("cameraSelection");
  
  let pricelistData = JSON.parse(localStorage.getItem("pricelistData") || "[]");
  let dataCount = localStorage.getItem("pricelistDataCount") || 0;
  let lastUpdated = localStorage.getItem("pricelistLastUpdated") || "N/A";
  
  // Display how many items are loaded, last updated
  updateDataInfo(dataCount, lastUpdated);
  
  // --- REFRESH FUNCTION (like admin.js) ---
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
  
        // Update global counters + UI
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
  
  // --- SEARCH FUNCTION ---
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
  
  // --- BARCODE SCANNER SETUP WITH CAMERA SELECTION ---
  let html5QrcodeScanner;
  let selectedCameraId = localStorage.getItem("preferredCameraId") || null;
  
  // Populate camera dropdown
  Html5Qrcode.getCameras()
    .then(devices => {
      if (!devices || devices.length === 0) {
        cameraSelection.innerHTML = "<option>No cameras found</option>";
        return;
      }
      cameraSelection.innerHTML = ""; // Clear old
      devices.forEach(device => {
        const option = document.createElement("option");
        option.value = device.id;
        option.text = device.label || `Camera ${cameraSelection.length + 1}`;
        cameraSelection.appendChild(option);
      });
      // If we have a previously saved camera ID, select it if it exists
      if (selectedCameraId) {
        cameraSelection.value = selectedCameraId;
      }
    })
    .catch(err => {
      console.warn("Error getting cameras:", err);
      cameraSelection.innerHTML = "<option>Error loading cameras</option>";
    });
  
  // If user changes the camera, store preference
  cameraSelection.addEventListener("change", (e) => {
    selectedCameraId = e.target.value;
    localStorage.setItem("preferredCameraId", selectedCameraId);
  });
  
  barcodeBtn.addEventListener("click", () => {
    scannerModal.style.display = "block";
    
    // Initialize if not done yet
    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5Qrcode("reader");
    }
    
    // Attempt advanced config
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      // If you want to try a zoom approach, you can add videoConstraints, but it may be ignored on some devices
      videoConstraints: {
        deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
        facingMode: "environment"
        // you can attempt zoom here if your device supports it: zoom: 2
      }
    };
    
    html5QrcodeScanner.start(
      selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: "environment" },
      config,
      (decodedText) => {
        // On successful scan
        searchInput.value = decodedText;
        performSearch(decodedText);
        stopScanner();
      },
      (errorMessage) => {
        // Optional: handle scan errors
        console.warn("Scan error:", errorMessage);
      }
    ).catch(err => {
      console.error("Unable to start scanning.", err);
    });
  });
  
  closeModal.addEventListener("click", stopScanner);
  
  function stopScanner() {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().then(() => {
        scannerModal.style.display = "none";
      });
    } else {
      scannerModal.style.display = "none";
    }
  }
  