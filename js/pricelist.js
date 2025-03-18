// Utility to safely parse string with commas, e.g. "125,000" -> 125000
function toNumber(str) {
    if (!str) return 0;
    // Remove all commas and parse
    const num = parseInt(str.replace(/,/g, ""), 10);
    return isNaN(num) ? 0 : num;
  }
  
  // Utility to format numbers as ###,### (no decimals)
  function formatNumber(value) {
    const numericValue = toNumber(value);
    return numericValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  
  // Load cached data
  let pricelistData = JSON.parse(localStorage.getItem("pricelistData") || "[]");
  console.log("Loaded data from localStorage:", pricelistData);
  
  const dataCount = localStorage.getItem("pricelistDataCount") || 0;
  const lastUpdated = localStorage.getItem("pricelistLastUpdated") || "N/A";
  
  // Show how many items are loaded + last updated
  const dataInfo = document.getElementById("data-info");
  dataInfo.textContent = `${dataCount} items loaded. Last updated: ${lastUpdated}`;
  
  const searchInput = document.getElementById("search-input");
  const resultsDiv = document.getElementById("results");
  
  // Search function – filters based on partial match of Barcode, Item Code, or Item Name
  function performSearch(query) {
    if (!pricelistData || !query) {
      resultsDiv.innerHTML = "";
      return;
    }
    query = query.toLowerCase();
    const filtered = pricelistData.filter(item => {
      // Ensure we handle missing fields safely
      const barcode = (item["Barcode"] || "").toLowerCase();
      const itemCode = (item["Item Code"] || "").toLowerCase();
      const itemName = (item["Item Name"] || "").toLowerCase();
      return (
        barcode.includes(query) ||
        itemCode.includes(query) ||
        itemName.includes(query)
      );
    }).slice(0, 30); // limit to 30 results
    
    renderResults(filtered);
  }
  
  function renderResults(results) {
    resultsDiv.innerHTML = "";
    results.forEach(item => {
      // Format prices and discount
      const retail = formatNumber(item["Retail Price"]);
      const net = formatNumber(item["Net Price"]);
      // For discount, if "Discount %" is something like "0", parse it safely
      const discountRaw = toNumber(item["Discount %"]);
      const discount = discountRaw.toLocaleString('en-US', { maximumFractionDigits: 0 });
      
      const div = document.createElement("div");
      div.classList.add("result-item");
      
      // Row 1: Item Name in small font
      const row1 = document.createElement("div");
      row1.classList.add("line1");
      row1.textContent = item["Item Name"] || "";
      
      // Row 2: Code: item code (left) | Barcode (right)
      const row2 = document.createElement("div");
      row2.classList.add("line2");
      const leftPart = document.createElement("span");
      leftPart.textContent = "Code: " + (item["Item Code"] || "");
      const rightPart = document.createElement("span");
      rightPart.textContent = item["Barcode"] || "";
      row2.appendChild(leftPart);
      row2.appendChild(rightPart);
      
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
  
  // Listen for input changes on the search box
  searchInput.addEventListener("input", (e) => {
    performSearch(e.target.value);
  });
  
  /* --- Barcode Scanner Setup --- */
  const barcodeBtn = document.getElementById("barcode-btn");
  const scannerModal = document.getElementById("scanner-modal");
  const closeModal = document.getElementById("close-modal");
  let html5QrcodeScanner;
  
  barcodeBtn.addEventListener("click", () => {
    scannerModal.style.display = "block";
    
    // Initialize html5-qrcode if not already initialized
    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5Qrcode("reader");
    }
    
    // Attempt to set advanced camera constraints with zoom = 2
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      // Attempt zoom. Not all devices/browsers will honor this.
      videoConstraints: {
        facingMode: "environment",
        zoom: 2
      }
    };
    
    html5QrcodeScanner.start(
      { facingMode: "environment" },
      config,
      (decodedText, decodedResult) => {
        // On successful scan, close modal and perform search with scanned value
        searchInput.value = decodedText;
        performSearch(decodedText);
        html5QrcodeScanner.stop().then(() => {
          scannerModal.style.display = "none";
        });
      },
      (errorMessage) => {
        // Optional: handle scan errors
        console.warn("Scan error:", errorMessage);
      }
    ).catch(err => {
      console.error("Unable to start scanning.", err);
    });
  });
  
  // When close icon is clicked, stop scanner and close modal
  closeModal.addEventListener("click", () => {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().then(() => {
        scannerModal.style.display = "none";
      });
    } else {
      scannerModal.style.display = "none";
    }
  });
  