// Utility to format numbers as ###,### (no decimals)
function formatNumber(num) {
    const number = Number(num);
    return number.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  
  // Load cached data
  let pricelistData = JSON.parse(localStorage.getItem("pricelistData") || "[]");
  
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
      return (
        (item["Barcode"] && item["Barcode"].toLowerCase().includes(query)) ||
        (item["Item Code"] && item["Item Code"].toLowerCase().includes(query)) ||
        (item["Item Name"] && item["Item Name"].toLowerCase().includes(query))
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
      const discount = formatNumber(item["Discount %"]);
      
      const div = document.createElement("div");
      div.classList.add("result-item");
      
      // Row 1: Item Name in small font
      const row1 = document.createElement("div");
      row1.classList.add("line1");
      row1.textContent = item["Item Name"];
      
      // Row 2: Code: item code (left) | Barcode (right)
      const row2 = document.createElement("div");
      row2.classList.add("line2");
      const leftPart = document.createElement("span");
      leftPart.textContent = "Code: " + item["Item Code"];
      const rightPart = document.createElement("span");
      rightPart.textContent = item["Barcode"];
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
  
  // When barcode button is clicked, open modal and start scanner
  barcodeBtn.addEventListener("click", () => {
    scannerModal.style.display = "block";
    
    // Initialize html5-qrcode if not already initialized
    if (!html5QrcodeScanner) {
      html5QrcodeScanner = new Html5Qrcode("reader");
    }
    
    // Camera configuration – you can adjust fps, qr box size etc. if needed.
    html5QrcodeScanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 } // rectangle shape for horizontal barcodes
      },
      (decodedText, decodedResult) => {
        // On successful scan, close modal and perform search with scanned value.
        searchInput.value = decodedText;
        performSearch(decodedText);
        html5QrcodeScanner.stop().then(() => {
          scannerModal.style.display = "none";
        });
      },
      (errorMessage) => {
        // Optionally, handle scan errors here
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
  