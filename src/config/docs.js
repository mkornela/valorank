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
        title: "🎖️ Informacje o Randze (Rozszerzone)",
        endpoint: "GET /rank/{name}/{tag}/{region}",
        description: "Pobierz aktualną rangę, RR i postęp do następnej rangi. Endpoint został połączony z funkcjonalnością dziennych statystyk, dzięki czemu możesz dołączyć do odpowiedzi bilans wygranych/przegranych, dzienną zmianę RR, zmianę RR z ostatniego meczu, a także statystyki (K/D/A) i agenta z ostatniej gry.",
        params: [
            '?text="{rank} ({rr} RR) | Ostatnia gra: {lastStats} jako {lastAgent}"',
            "Dostępne zmienne: {name}, {tag}, {lb}, {rank}, {rr}, {rrToGoal}, {goal}, {wl}, {dailyRR}, {lastRR}, {lastStats}, {lastAgent}",
            "?resetTime=HHMM - Własny czas dziennego resetu (np. 0800)",
            "?goalRank=RANK - Własny cel rangi (np. Immortal)"
        ],
        example: {
            request: "/rank/Szalony/123/eu?text={rank} ({rr}RR) | Ostatnio: {lastAgent} ({lastStats})",
            response: "Diament 2 (67RR) | Ostatnio: Jett (21/15/8)"
        }
    },
    {
        title: "📅 Dzienne Statystyki",
        endpoint: "GET /daily/{name}/{tag}/{region}",
        description: "Zwraca podsumowanie dzisiejszych statystyk gracza włącznie z rangą, bilansem W/L i zmianą RR.",
        params: [
            "?resetTime=HHMM - Własny czas dziennego resetu (np. 0800)"
        ],
        example: {
            request: "/daily/Szalony/123/eu",
            response: "Diament 2 67RR | Bilans: 3W/1L | Dzisiaj: +33RR | Last: +23RR"
        }
    },
    {
        title: "🔍 Surowe Dane Rankingu",
        endpoint: "GET /rankraw/{name}/{tag}/{region}",
        description: "Zwraca surowe dane API dotyczące gracza bez formatowania. Przydatne do debugowania i integracji.",
        params: [],
        example: {
            request: "/rankraw/Szalony/123/eu",
            response: "{ mmr: {...}, account: {...} }"
        }
    },
    {
        title: "🏅 Wyszukiwanie w Tabeli Wyników",
        endpoint: "GET /getrank/{position}",
        description: "Wyszukaj graczy po ich pozycji w tabeli wyników (top 15000). Pokazuje rating, wygrane i link do trackera. Dane pochodzą ze statycznego pliku.",
        params: [
            "position: 1-15000 (pozycja w tabeli)"
        ],
        example: {
            request: "/getrank/50",
            response: "Player#TAG | Rating: 892RR | Wygrane: 156 | Tracker: ..."
        }
    },
    {
        title: "🔮 Nadchodzące Mecze",
        endpoint: "GET /nextmatch/{event}",
        description: "Znajdź następny mecz dla określonego wydarzenia e-sportowego. Dane pobierane z VLR.gg.",
        params: [
            "event: Nazwa wydarzenia (np. VCT, EMEA)"
        ],
        example: {
            request: "/nextmatch/VCT",
            response: "Następny mecz na \"VCT\" to: Team A vs Team B za 2h 30m (2025-01-15 18:00)"
        }
    },
    {
        title: "📅 Dzienne Mecze",
        endpoint: "GET /dailymatches/{event}",
        description: "Pobierz wszystkie dzisiejsze mecze dla określonego wydarzenia e-sportowego. Dane pobierane z VLR.gg.",
        params: [
            "event: Nazwa wydarzenia (np. VCT, EMEA)"
        ],
        example: {
            request: "/dailymatches/VCT",
            response: "Dzisiejsze mecze VCT International: 14:00 Team A vs Team B | 17:00 Team C vs Team D"
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
    },
    {
        title: "🩺 Health Check",
        endpoint: "GET /health",
        description: "Zwraca status techniczny API. Służy do monitorowania działania serwisu. Zwraca kod 200, jeśli wszystko działa, lub 503, jeśli występuje problem.",
        params: [],
        example: {
            request: "/health",
            response: "{ \"status\": \"operational\", \"timestamp\": \"...\", ... }"
        }
    },
    {
        title: "🖥️ Strona Statusu API",
        endpoint: "GET /status",
        description: "Wyświetla przyjazną dla użytkownika stronę z wizualizacją dostępności API w ciągu ostatnich 90 dni.",
        params: [],
        example: {
            request: "/status",
            response: "Zwraca stronę HTML z paskami statusu..."
        }
    },
    {
        title: "📚 Dokumentacja API",
        endpoint: "GET /api-docs",
        description: "Interaktywna dokumentacja Swagger UI z pełnym opisem wszystkich endpointów API.",
        params: [],
        example: {
            request: "/api-docs",
            response: "Zwraca stronę Swagger UI..."
        }
    }
];

module.exports = apiEndpoints;