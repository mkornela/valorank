document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/health';
    const DAYS_TO_SHOW = 90;
    const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minut

    const mainStatusText = document.getElementById('main-status-text');
    const statusIndicator = document.getElementById('status-indicator');
    const lastUpdatedText = document.getElementById('last-updated');
    const timelineGrid = document.getElementById('timeline-grid');

    const STATUS_MAP = {
        operational: { text: "Wszystkie systemy działają", class: "operational" },
        degraded: { text: "Zdegradowana wydajność", class: "degraded" },
        error: { text: "Poważna awaria", class: "error" }
    };

    function getTodayString() {
        const today = new Date();
        return today.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    function getHistory() {
        try {
            const history = localStorage.getItem('apiStatusHistory');
            return history ? JSON.parse(history) : {};
        } catch (e) {
            console.error("Failed to parse history from localStorage", e);
            return {};
        }
    }

    function saveHistory(history) {
        // Usuń stare wpisy, aby historia nie rosła w nieskończoność
        const sortedKeys = Object.keys(history).sort().reverse();
        const cleanedHistory = {};
        for (let i = 0; i < Math.min(sortedKeys.length, DAYS_TO_SHOW); i++) {
            const key = sortedKeys[i];
            cleanedHistory[key] = history[key];
        }
        localStorage.setItem('apiStatusHistory', JSON.stringify(cleanedHistory));
    }

    function renderGrid() {
        timelineGrid.innerHTML = '';
        const history = getHistory();
        const today = new Date();

        for (let i = DAYS_TO_SHOW - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];

            const status = history[dateString] || 'no-data';
            
            const bar = document.createElement('div');
            bar.className = `timeline-bar ${status}`;

            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = `<strong>${dateString}</strong><br>Status: ${status}`;
            
            bar.appendChild(tooltip);
            timelineGrid.appendChild(bar);
        }
    }

    async function updateStatus() {
        lastUpdatedText.textContent = `Sprawdzanie...`;
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            
            const statusInfo = STATUS_MAP[data.status] || { text: "Nieznany status", class: "no-data" };
            
            mainStatusText.textContent = statusInfo.text;
            statusIndicator.className = `status-indicator ${statusInfo.class}`;

            const history = getHistory();
            const today = getTodayString();
            
            // Zapisz najgorszy status danego dnia
            const currentDayStatus = history[today];
            if (!currentDayStatus || (statusInfo.class === 'error') || (statusInfo.class === 'degraded' && currentDayStatus !== 'error')) {
                history[today] = statusInfo.class;
            }

            saveHistory(history);
            renderGrid();

        } catch (error) {
            console.error("Fetch error:", error);
            mainStatusText.textContent = "Błąd połączenia z API";
            statusIndicator.className = 'status-indicator error';

            const history = getHistory();
            history[getTodayString()] = 'error';
            saveHistory(history);
            renderGrid();
        } finally {
            lastUpdatedText.textContent = `Ostatnia aktualizacja: ${new Date().toLocaleTimeString()}`;
        }
    }

    // Inicjalizacja
    renderGrid();
    updateStatus();
    setInterval(updateStatus, CHECK_INTERVAL);
});