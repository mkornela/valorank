const apiEndpoints = [
    {
        title: "🏆 Tracker Wygranych/Przegranych",
        endpoint: "GET /wl/{name}/{tag}/{region}",
        description: "Śledź swoje dzienne wygrane i przegrane w trybie rankingowym. Zwraca prosty format pokazujący wyniki sesji.",
        params: [
            "?resetTime=HHMM - Własny czas dziennego resetu (np. 0800)",
            "?sessionStart=timestamp - Własny początek sesji (w sekundach unix)"
        ],
        example: {
            request: "/wl/Szalony/123/eu?resetTime=0800",
            response: "5W/2L"
        }
    },
    {
        title: "📊 Zaawansowane W/L",
        endpoint: "GET /advanced_wl/{name}/{tag}/{region}",
        description: "Rozszerzone śledzenie W/L z detalami ostatniego meczu, w tym zmiany RR i wynik.",
        params: [
            "?resetTime=HHMM - Własny czas dziennego resetu (np. 0800)"
        ],
        example: {
            request: "/advanced_wl/Szalony/123/eu",
            response: "3W/1L (Ostatni: W +23RR)"
        }
    },
    {
        title: "🎖️ Informacje o Randze",
        endpoint: "GET /rank/{name}/{tag}/{region}",
        description: "Pobierz aktualną rangę, RR i postęp do następnej rangi z personalizowanym formatowaniem tekstu.",
        params: [
            '?text="{rank} ({rr} RR) | {rrToGoal} RR do {goal}"',
            "Dostępne zmienne: {name}, {tag}, {rank}, {rr}, {rrToGoal}, {goal}"
        ],
        example: {
            request: "/rank/Szalony/123/eu",
            response: "Diament 2 (67 RR) | 33 RR do Diament 3"
        }
    },
    {
        title: "🏅 Wyszukiwanie w Tabeli Wyników",
        endpoint: "GET /getrank/{position}",
        description: "Wyszukaj graczy po ich pozycji w tabeli wyników (tylko EU, top 1000). Pokazuje rating, wygrane i link do trackera. Dane pochodzą ze statycznego pliku.",
        params: [
            "position: 1-1000 (pozycja w tabeli)"
        ],
        example: {
            request: "/getrank/50",
            response: "Player#TAG | Rating: 892RR | Wygrane: 156 | Tracker: ..."
        }
    },
    {
        title: "📈 Strona ze Statystykami",
        endpoint: "GET /statystyki",
        description: "Zwraca w pełni renderowaną stronę HTML z zaawansowanymi, dziennymi statystykami dla głównego gracza skonfigurowanego w aplikacji.",
        params: [],
        example: {
            request: "/statystyki",
            response: "Zwraca stronę HTML..."
        }
    }
];

module.exports = apiEndpoints;