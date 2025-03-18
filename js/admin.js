document.getElementById('refresh-btn').addEventListener('click', function () {
    const loadingMessage = document.getElementById('loading-message');
    const statusMessage = document.getElementById('status-message');
    
    // Clear old messages
    loadingMessage.textContent = "Starting data refresh...";
    statusMessage.textContent = "";
  
    // Google Sheet CSV export URL (make sure the sheet is public or 'Anyone with the link'):
    const sheetUrl = "https://docs.google.com/spreadsheets/d/1hCqLjZ8KcOV8sR9Q65mltuUwYLcuGmKsuN2HZz5Ig1o/export?format=csv";
  
    fetch(sheetUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not OK");
        }
        loadingMessage.textContent = "Downloading CSV from Google Sheets...";
        return response.text();
      })
      .then(csvData => {
        loadingMessage.textContent = "Parsing CSV...";
        const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
  
        console.log("Parsed data:", parsed.data); // Debug in browser console
  
        // Save parsed data to localStorage
        localStorage.setItem("pricelistData", JSON.stringify(parsed.data));
  
        // Store row count and timestamp
        const rowCount = parsed.data.length;
        const nowString = new Date().toLocaleString();
        localStorage.setItem("pricelistDataCount", rowCount);
        localStorage.setItem("pricelistLastUpdated", nowString);
  
        loadingMessage.textContent = "";
        statusMessage.textContent = `Data refreshed successfully. ${rowCount} rows loaded on ${nowString}.`;
      })
      .catch(error => {
        loadingMessage.textContent = "";
        statusMessage.textContent = "Error refreshing data: " + error;
      });
  });
  