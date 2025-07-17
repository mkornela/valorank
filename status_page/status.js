document.addEventListener('DOMContentLoaded', () => {
    // Od teraz używamy tylko jednego, głównego endpointu API
    const API_URL = '/api/status';
    const CHECK_INTERVAL = 5 * 60 * 1000;
    const DAYS_TO_SHOW_TIMELINE = 90;

    const elements = {
        mainStatusText: document.getElementById('main-status-text'),
        statusDescription: document.getElementById('status-description'),
        statusIcon: document.getElementById('status-icon'),
        lastUpdated: document.getElementById('last-updated'),
        servicesList: document.getElementById('services-list'),
        timelineGrid: document.getElementById('timeline-grid'),
        timelinePeriod: document.getElementById('timeline-period'),
        incidentLog: document.getElementById('incident-log')
    };

    const STATUS_CONFIG = {
        operational: { text: "Wszystkie systemy działają", description: "Wszystkie usługi działają bez zakłóceń.", serviceText: "Operacyjny", class: "operational" },
        degraded: { text: "Zdegradowana wydajność", description: "Niektóre usługi mogą działać wolniej.", serviceText: "Zdegradowany", class: "degraded" },
        error: { text: "Poważna awaria", description: "Wystąpiły krytyczne problemy z dostępnością usług.", serviceText: "Awaria", class: "error" },
        maintenance: { text: "Planowana konserwacja", description: "Prowadzimy prace konserwacyjne.", serviceText: "Konserwacja", class: "maintenance" }
    };

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

    function updateOverallStatusUI(status) {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.error;
        elements.mainStatusText.textContent = config.text;
        elements.statusDescription.textContent = config.description;
        elements.statusIcon.className = `status-icon ${config.class}`;
    }

    function renderServices(services = {}) {
        elements.servicesList.innerHTML = Object.values(services).map(service => {
            const config = STATUS_CONFIG[service.status] || STATUS_CONFIG.error;
            return `
                <div class="service-item ${config.class}">
                    <div class="service-header">
                        <div class="service-name">${service.name}</div>
                        <span class="service-status ${config.class}">${config.serviceText}</span>
                    </div>
                    <div class="service-description">${service.description}</div>
                </div>`;
        }).join('') || '<p>Brak skonfigurowanych usług do monitorowania.</p>';
    }

    function renderIncidents(incidents = []) {
        if (!elements.incidentLog || incidents.length === 0) {
            elements.incidentLog.innerHTML = '<p>Brak incydentów w ostatnim czasie.</p>';
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

    function renderTimeline(history = {}) {
        elements.timelineGrid.innerHTML = '';
        const today = new Date();
        for (let i = DAYS_TO_SHOW_TIMELINE - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            const status = history[dateString] || 'no-data';
            const statusText = STATUS_CONFIG[status]?.serviceText || 'Brak danych';
            elements.timelineGrid.innerHTML += `
                <div class="timeline-bar ${status}">
                    <div class="tooltip"><strong>${formatDate(dateString)}</strong><br>Status: ${statusText}</div>
                </div>`;
        }
    }

    async function checkStatus() {
        elements.lastUpdated.classList.add('loading');
        elements.lastUpdated.textContent = 'Aktualizowanie...';
        try {
            // Jedno zapytanie, które pobiera wszystkie potrzebne dane
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error(`Błąd API: ${response.statusText}`);
            }
            const data = await response.json();

            // Renderujemy wszystkie komponenty na podstawie jednej odpowiedzi
            updateOverallStatusUI(data.overallStatus);
            renderServices(data.services);
            renderIncidents(data.incidents);
            renderTimeline(data.history);

        } catch (error) {
            console.error('Błąd podczas sprawdzania statusu:', error);
            updateOverallStatusUI('error');
            elements.servicesList.innerHTML = `<div class="service-item error"><div class="service-name">Błąd połączenia z API</div></div>`;
            elements.incidentLog.innerHTML = `<p>Nie można załadować historii incydentów.</p>`;
            elements.timelineGrid.innerHTML = `<p>Nie można załadować osi czasu.</p>`;
        } finally {
            const now = new Date();
            elements.lastUpdated.textContent = `Ostatnia aktualizacja: ${now.toLocaleTimeString('pl-PL')}`;
            elements.lastUpdated.classList.remove('loading');
        }
    }

    checkStatus();
    setInterval(checkStatus, CHECK_INTERVAL);
});