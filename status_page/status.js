document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api/status';
    const CHECK_INTERVAL = 5 * 60 * 1000;
    let initialHistoryData = {};

    let currentDetailViewDate = null;
    let detailUpdateInterval = null;

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
        clearInterval(detailUpdateInterval);
        currentDetailViewDate = null;

        elements.timelineGrid.innerHTML = '';
        elements.timelineGrid.classList.remove('detailed-view');
        elements.backButton.style.display = 'none';
        elements.timelinePeriod.style.display = 'block';
        elements.timelinePeriod.textContent = 'Ostatnie 90 dni';

        const sortedDates = Object.keys(history).sort((a, b) => new Date(a) - new Date(b));

        for (const dateString of sortedDates) {
            const status = history[dateString] || 'no-data';
            const config = STATUS_CONFIG[status] || STATUS_CONFIG['no-data'];
            const bar = document.createElement('div');
            bar.className = `timeline-bar ${config.class}`;
            bar.dataset.date = dateString;
            bar.innerHTML = `<div class="tooltip"><strong>${formatDate(dateString)}</strong><br>Status: ${config.serviceText}<br><small>Kliknij, aby zobaczyć szczegóły</small></div>`;
            bar.addEventListener('click', () => showDetailedView(dateString));
            elements.timelineGrid.appendChild(bar);
        }
    }

    async function showDetailedView(dateString) {
        clearInterval(detailUpdateInterval);
        currentDetailViewDate = dateString;

        elements.timelineGrid.innerHTML = '<div class="skeleton-timeline"><div class="skeleton skeleton-bar"></div></div>';
        elements.timelinePeriod.textContent = `Ładowanie dla: ${formatDate(dateString)}...`;
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
        
        document.querySelector('.timeline-header .section-title').textContent = `Szczegółowy status: ${formatDate(dateString)}`;

        const todayDateString = new Date().toISOString().split('T')[0];
        const isToday = (dateString === todayDateString);

        let minutesToRender;
        if (isToday) {
            const now = new Date();
            minutesToRender = now.getHours() * 60 + now.getMinutes();
        } else {
            minutesToRender = 24 * 60;
        }

        for (let i = 0; i <= minutesToRender; i++) {
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

        if (isToday) {
            startLiveUpdate();
        }
    }

    function startLiveUpdate() {
        clearInterval(detailUpdateInterval);
        detailUpdateInterval = setInterval(appendLatestMinute, 60000); 
    }
    
    async function appendLatestMinute() {
        if (!currentDetailViewDate) return;

        try {
            const response = await fetch(`/api/status/details?date=${currentDetailViewDate}`);
            const details = await response.json();
            
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0].substring(0, 5);

            const currentBlockCount = elements.timelineGrid.children.length;
            const expectedBlockCount = now.getHours() * 60 + now.getMinutes();
            if (currentBlockCount > expectedBlockCount) return;

            const data = details[timeString];
            const status = data ? data.status : 'no-data';
            const config = STATUS_CONFIG[status] || STATUS_CONFIG['no-data'];

            const block = document.createElement('div');
            block.className = `timeline-block ${config.class}`;
            block.innerHTML = `<div class="tooltip">${timeString}<br>Status: ${config.serviceText}</div>`;
            elements.timelineGrid.appendChild(block);

        } catch (error) {
            console.error("Błąd podczas dołączania minuty:", error);
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
            
            if (!currentDetailViewDate) {
                renderTimelineSummary(data.history);
            }

        } catch (error) {
            console.error('Błąd podczas sprawdzania statusu:', error);
            updateOverallStatusUI('error');
        } finally {
            const now = new Date();
            elements.lastUpdated.textContent = `Ostatnia aktualizacja: ${now.toLocaleTimeString('pl-PL')}`;
            elements.lastUpdated.classList.remove('loading');
        }
    }

    elements.backButton.addEventListener('click', () => {
        document.querySelector('.timeline-header .section-title').textContent = 'Historia dostępności';
        renderTimelineSummary(initialHistoryData);
    });

    checkStatus();
    setInterval(checkStatus, CHECK_INTERVAL);
});