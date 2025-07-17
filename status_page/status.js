document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/health';
    const DAYS_TO_SHOW = 90;
    const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

    const elements = {
        mainStatusText: document.getElementById('main-status-text'),
        statusDescription: document.getElementById('status-description'),
        statusIcon: document.getElementById('status-icon'),
        serviceStatus: document.getElementById('service-status'),
        mainService: document.getElementById('main-service'),
        lastUpdated: document.getElementById('last-updated'),
        timelineGrid: document.getElementById('timeline-grid'),
        timelinePeriod: document.getElementById('timeline-period')
    };

    const STATUS_CONFIG = {
        operational: {
            text: "Wszystkie systemy działają",
            description: "Wszystkie usługi działają bez zakłóceń",
            serviceText: "Operacyjny",
            class: "operational"
        },
        degraded: {
            text: "Zdegradowana wydajność",
            description: "Niektóre usługi mogą działać wolniej",
            serviceText: "Zdegradowany",
            class: "degraded"
        },
        error: {
            text: "Wykryto problemy",
            description: "Wystąpiły problemy z dostępnością usług",
            serviceText: "Awaria",
            class: "error"
        },
        maintenance: {
            text: "Planowana konserwacja",
            description: "Trwają prace konserwacyjne",
            serviceText: "Konserwacja",
            class: "maintenance"
        }
    };

    function getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pl-PL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function getHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('apiStatusHistory') || '{}');
            return history;
        } catch (e) {
            console.error("Failed to parse history:", e);
            return {};
        }
    }

    function saveHistory(history) {
        const sortedKeys = Object.keys(history).sort().reverse();
        const cleanedHistory = {};
        
        for (let i = 0; i < Math.min(sortedKeys.length, DAYS_TO_SHOW); i++) {
            cleanedHistory[sortedKeys[i]] = history[sortedKeys[i]];
        }
        
        localStorage.setItem('apiStatusHistory', JSON.stringify(cleanedHistory));
    }

    function updateUI(status) {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.error;
        
        elements.mainStatusText.textContent = config.text;
        elements.statusDescription.textContent = config.description;
        elements.statusIcon.className = `status-icon ${config.class}`;
        elements.serviceStatus.textContent = config.serviceText;
        elements.serviceStatus.className = `service-status ${config.class}`;
        elements.mainService.className = `service-item ${config.class}`;
    }

    function renderTimeline() {
        const history = getHistory();
        const historyKeys = Object.keys(history).sort();
        elements.timelineGrid.innerHTML = '';

        // Update timeline period text
        if (historyKeys.length === 0) {
            elements.timelinePeriod.textContent = 'Brak danych';
            
            // Show today as a starting point
            const today = new Date();
            const todayString = today.toISOString().split('T')[0];
            
            const bar = document.createElement('div');
            bar.className = 'timeline-bar no-data';
            
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = `
                <strong>${formatDate(todayString)}</strong><br>
                Status: Brak danych
            `;
            
            bar.appendChild(tooltip);
            elements.timelineGrid.appendChild(bar);
            return;
        }

        // Update period text with actual date range
        const firstDate = formatDate(historyKeys[0]);
        const lastDate = formatDate(historyKeys[historyKeys.length - 1]);
        const dayCount = historyKeys.length;
        
        if (dayCount === 1) {
            elements.timelinePeriod.textContent = `1 dzień (${firstDate})`;
        } else {
            elements.timelinePeriod.textContent = `${dayCount} dni (${firstDate} - ${lastDate})`;
        }

        // Show only days with actual data
        historyKeys.forEach(dateString => {
            const status = history[dateString];
            
            const bar = document.createElement('div');
            bar.className = `timeline-bar ${status}`;
            
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = `
                <strong>${formatDate(dateString)}</strong><br>
                Status: ${STATUS_CONFIG[status]?.serviceText || 'Nieznany'}
            `;
            
            bar.appendChild(tooltip);
            elements.timelineGrid.appendChild(bar);
        });
    }

    async function checkStatus() {
        try {
            elements.lastUpdated.textContent = 'Sprawdzanie...';
            
            const response = await fetch(API_URL);
            const data = await response.json();
            
            const status = data.status || 'error';
            updateUI(status);
            
            const history = getHistory();
            const today = getTodayString();
            
            // Save worst status of the day
            const currentStatus = history[today];
            const statusPriority = { operational: 1, degraded: 2, maintenance: 3, error: 4 };
                    
            if (!currentStatus || (statusPriority[status] || 4) > (statusPriority[currentStatus] || 0)) {
                history[today] = status;
                saveHistory(history);
            }
            
            renderTimeline();
            
        } catch (error) {
            console.error('Status check failed:', error);
            updateUI('error');
            
            const history = getHistory();
            history[getTodayString()] = 'error';
            saveHistory(history);
            renderTimeline();
        } finally {
            const now = new Date();
            elements.lastUpdated.textContent = `Ostatnia aktualizacja: ${now.toLocaleString('pl-PL')}`;
        }
    }

    // Initialize
    renderTimeline();
    checkStatus();
    setInterval(checkStatus, CHECK_INTERVAL);
});