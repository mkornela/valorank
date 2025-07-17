document.addEventListener('DOMContentLoaded', () => {
    // Endpoint jest teraz serwowany przez ten sam serwer, więc używamy ścieżki względnej.
    const API_URL = '/health'; 
    const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minut

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

    // Konfiguracja statusów pozostaje bez zmian
    const STATUS_CONFIG = {
        operational: { text: "Wszystkie systemy działają", description: "Wszystkie usługi działają bez zakłóceń.", serviceText: "Operacyjny", class: "operational" },
        degraded: { text: "Zdegradowana wydajność", description: "Niektóre usługi mogą działać wolniej lub być niedostępne.", serviceText: "Zdegradowany", class: "degraded" },
        error: { text: "Poważna awaria", description: "Wystąpiły krytyczne problemy z dostępnością usług.", serviceText: "Awaria", class: "error" },
        maintenance: { text: "Planowana konserwacja", description: "Prowadzimy prace konserwacyjne w celu ulepszenia usług.", serviceText: "Konserwacja", class: "maintenance" }
    };
    
    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

    function updateOverallStatusUI(status) {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.error;
        elements.mainStatusText.textContent = config.text;
        elements.statusDescription.textContent = config.description;
        elements.statusIcon.className = `status-icon ${config.class}`;
    }

    /**
     * Nowa funkcja do renderowania usług na podstawie odpowiedzi z /health
     */
    function renderServices(checks) {
        if (!elements.servicesList) return;

        const serviceMapping = {
            henrik_api: { name: 'Zewnętrzne API (Henrik)', description: 'Kluczowe API dostarczające dane o grze.' },
            stats_file: { name: 'Plik ze statystykami', description: 'Wygenerowany plik HTML ze statystykami graczy.' },
            docs_file: { name: 'Plik dokumentacji', description: 'Dokumentacja API wygenerowana automatycznie.' }
        };

        elements.servicesList.innerHTML = Object.entries(checks).map(([key, check]) => {
            const serviceInfo = serviceMapping[key] || { name: key, description: 'Monitorowany komponent systemowy.' };
            
            // Mapowanie statusu z backendu na status w frontendzie
            let currentStatus = 'operational';
            if (check.status === 'missing' || check.status === 'unreachable') {
                currentStatus = 'error';
            } else if (check.status === 'degraded') {
                currentStatus = 'degraded';
            }

            const config = STATUS_CONFIG[currentStatus];

            return `
                <div class="service-item ${config.class}">
                    <div class="service-header">
                        <div class="service-name">${serviceInfo.name}</div>
                        <span class="service-status ${config.class}">${config.serviceText}</span>
                    </div>
                    <div class="service-description">${serviceInfo.description}</div>
                </div>
            `;
        }).join('');
    }

    /**
     * UWAGA: Sekcje incydentów i historii na razie są statyczne.
     * Poniżej znajduje się wyjaśnienie, jak je zaimplementować.
     */
    function renderStaticIncidents() {
        if (!elements.incidentLog) return;
        elements.incidentLog.innerHTML = `
             <div class="incident-card maintenance">
                <div class="incident-date">${formatDate(new Date().toISOString())}</div>
                <div class="incident-message">System monitorowania został zintegrowany z backendem aplikacji. Historia incydentów zostanie wkrótce zaimplementowana.</div>
            </div>
        `;
    }

    function renderTimelinePlaceholder() {
         if (!elements.timelineGrid) return;
         elements.timelineGrid.innerHTML = `<p style="text-align:center; width: 100%; color: var(--text-muted);">Funkcjonalność historii dostępności jest w trakcie implementacji.</p>`;
    }


    async function checkStatus() {
        try {
            elements.lastUpdated.classList.add('loading');
            elements.lastUpdated.textContent = 'Aktualizowanie...';
            
            const response = await fetch(API_URL);
            if (!response.ok) {
                // Nawet jeśli odpowiedź to 503, nadal jest to JSON, który możemy przetworzyć
                if (response.headers.get("content-type")?.includes("application/json")) {
                     const errorData = await response.json();
                     throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            
            const data = await response.json();
            
            updateOverallStatusUI(data.status);
            renderServices(data.checks);

            // Na razie renderujemy statyczne dane dla incydentów i historii
            renderStaticIncidents();
            renderTimelinePlaceholder();
            
        } catch (error) {
            console.error('Status check failed:', error);
            updateOverallStatusUI('error');
            elements.servicesList.innerHTML = `<div class="service-item error"><div class="service-name">Błąd połączenia</div><div class="service-description">Nie udało się pobrać statusu z serwera. Sprawdź konsolę, aby uzyskać więcej informacji.</div></div>`;
            renderStaticIncidents();
            renderTimelinePlaceholder();

        } finally {
            const now = new Date();
            elements.lastUpdated.textContent = `Ostatnia aktualizacja: ${now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
            elements.lastUpdated.classList.remove('loading');
        }
    }

    // Pierwsze wywołanie i ustawienie interwału
    checkStatus();
    setInterval(checkStatus, CHECK_INTERVAL);
});