document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/status';
    const CHECK_INTERVAL = 5 * 60 * 1000;
    let initialHistoryData = {};

    const elements = {
        mainStatusText: document.getElementById('main-status-text'),
        statusDescription: document.getElementById('status-description'),
        statusIcon: document.getElementById('status-icon'),
        lastUpdated: document.getElementById('last-updated'),
        servicesList: document.getElementById('services-list'),
        timelineGrid: document.getElementById('timeline-grid'),
        timelinePeriod: document.getElementById('timeline-period'),
        incidentLog: document.getElementById('incident-log'),
        backButton: document.getElementById('back-to-summary')
    };

    const STATUS_CONFIG = {
        operational: { text: "Wszystkie systemy działają", description: "Wszystkie usługi działają bez zakłóceń.", serviceText: "Operacyjny", class: "operational" },
        degraded: { text: "Zdegradowana wydajność", description: "Niektóre usługi mogą działać wolniej.", serviceText: "Zdegradowany", class: "degraded" },
        error: { text: "Poważna awaria", description: "Wystąpiły krytyczne problemy z dostępnością usług.", serviceText: "Awaria", class: "error" },
        maintenance: { text: "Planowana konserwacja", description: "Prowadzimy prace konserwacyjne.", serviceText: "Konserwacja", class: "maintenance" },
        'no-data': { text: "Brak danych", serviceText: "Brak Danych", class: "no-data"}
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

    function updateOverallStatusUI(status) {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.error;
        elements.mainStatusText.textContent = config.text;
        elements.statusDescription.textContent = config.description;
        elements.statusIcon.className = `status-icon ${config.class}`;
    }

    function renderServices(services = {}) {
        const content = Object.values(services).map(service => {
            const config = STATUS_CONFIG[service.status] || STATUS_CONFIG.error;
            return `
                <div class="service-item ${config.class}">
                    <div class="service-header">
                        <div class="service-name">${service.name}</div>
                        <span class="service-status ${config.class}">${config.serviceText}</span>
                    </div>
                </div>`;
        }).join('');
        elements.servicesList.innerHTML = content || '<p>Brak skonfigurowanych usług do monitorowania.</p>';
    }
    
    function renderIncidents(incidents = []) {
        if (!incidents || incidents.length === 0) {
            elements.incidentLog.innerHTML = '<div class="incident-card"><p>Brak incydentów w ostatnim czasie.</p></div>';
            return;
        }
        elements.incidentLog.innerHTML = incidents.map(incident => {
            const config = STATUS_CONFIG[incident.status] || STATUS_CONFIG.degraded;
            return `
                 <div class="incident-card ${config.class}">
                    <div class="incident-date">${formatDate(incident.date)}</div>
                    <div class="incident-message">${incident.message}</div>
                </div>`;
        }).join('');
    }

    function renderTimelineSummary(history) {
        elements.timelineGrid.innerHTML = '';
        elements.timelineGrid.classList.remove('detailed-view');
        elements.backButton.style.display = 'none';
        elements.timelinePeriod.style.display = 'block';

        const sortedDates = Object.keys(history).sort((a, b) => new Date(a) - new Date(b));

        for (const dateString of sortedDates) {
            const status = history[dateString] || 'no-data';
            const config = STATUS_CONFIG[status] || STATUS_CONFIG['no-data'];
            const bar = document.createElement('div');
            bar.className = `timeline-bar ${config.class}`;
            bar.dataset.date = dateString;
            bar.innerHTML = `<div class="tooltip"><strong>${formatDate(dateString)}</strong><br>Status: ${config.serviceText}</div>`;
            bar.addEventListener('click', () => showDetailedView(dateString));
            elements.timelineGrid.appendChild(bar);
        }
    }

    async function showDetailedView(dateString) {
        elements.timelineGrid.innerHTML = '<div class="skeleton-timeline"><div class="skeleton skeleton-bar"></div></div>';
        try {
            const response = await fetch(`/api/status/details?date=${dateString}`);
            const details = await response.json();
            renderTimelineDetail(dateString, details);
        } catch (error) {
            console.error('Błąd pobierania szczegółów dnia:', error);
            elements.timelineGrid.innerHTML = '<p class="error-message">Nie udało się załadować szczegółów.</p>';
        }
    }

    function renderTimelineDetail(dateString, details) {
        elements.timelineGrid.innerHTML = '';
        elements.timelineGrid.classList.add('detailed-view');
        elements.backButton.style.display = 'block';
        elements.timelinePeriod.style.display = 'none';
        
        elements.timelinePeriod.textContent = formatDate(dateString);

        const totalMinutes = 24 * 60;
        for (let i = 0; i < totalMinutes; i++) {
            const hour = Math.floor(i / 60).toString().padStart(2, '0');
            const minute = (i % 60).toString().padStart(2, '0');
            const timeString = `${hour}:${minute}`;
            
            const data = details[timeString];
            const status = data ? data.status : 'no-data';
            const config = STATUS_CONFIG[status] || STATUS_CONFIG['no-data'];

            const block = document.createElement('div');
            block.className = `timeline-block ${config.class}`;
            block.innerHTML = `<div class="tooltip">${timeString}<br>Status: ${config.serviceText}</div>`;
            elements.timelineGrid.appendChild(block);
        }
    }
    
    async function checkStatus() {
        elements.lastUpdated.classList.add('loading');
        elements.lastUpdated.textContent = 'Aktualizowanie...';
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`Błąd API: ${response.statusText}`);
            const data = await response.json();

            initialHistoryData = data.history;
            updateOverallStatusUI(data.overallStatus);
            renderServices(data.services);
            renderIncidents(data.incidents);
            renderTimelineSummary(data.history);

        } catch (error) {
            console.error('Błąd podczas sprawdzania statusu:', error);
            updateOverallStatusUI('error');
        } finally {
            const now = new Date();
            elements.lastUpdated.textContent = `Ostatnia aktualizacja: ${now.toLocaleTimeString('pl-PL')}`;
            elements.lastUpdated.classList.remove('loading');
        }
    }

    elements.backButton.addEventListener('click', () => renderTimelineSummary(initialHistoryData));

    checkStatus();
    setInterval(checkStatus, CHECK_INTERVAL);
});