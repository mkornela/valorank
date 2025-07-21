require('dotenv').config();
const fs = require('fs');
const { formatInTimeZone } = require('date-fns-tz');
const log = require('../src/utils/logger');
const { fetchFromHenrikApi, initFetch } = require('../src/services/api');
const config = require('../src/config');
const { MAX_MATCHES_PER_REQUEST } = require('../src/constants');

const { STATS_PLAYER_NAME, STATS_PLAYER_TAG, STATS_PLAYER_REGION } = config;
const STOP_DATE = new Date('2025-06-28T08:00:00Z');
const TIMEZONE = 'Europe/Warsaw';
const START_DATE_FOR_LABELS = '2024-06-28';
const OUTPUT_FILE_NAME = 'valorant_stats.html';
const MAX_API_REQUESTS = 50;
const FETCH_INTERVAL = 2500;

const TIER_ICONS = { 0: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/0/largeicon.png',3: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/3/largeicon.png',4: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/4/largeicon.png',5: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/5/largeicon.png',6: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/6/largeicon.png',7: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/7/largeicon.png',8: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/8/largeicon.png',9: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/9/largeicon.png',10: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/10/largeicon.png',11: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/11/largeicon.png',12: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/12/largeicon.png',13: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/13/largeicon.png',14: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/14/largeicon.png',15: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/15/largeicon.png',16: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/16/largeicon.png',17: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/17/largeicon.png',18: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/18/largeicon.png',19: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/19/largeicon.png',20: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/20/largeicon.png',21: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/21/largeicon.png',22: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/22/largeicon.png',23: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/23/largeicon.png',24: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/24/largeicon.png',25: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/25/largeicon.png',26: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/26/largeicon.png',27: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/27/largeicon.png', };

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function fetchAllMatchesUntilDate() {
    const allMatches = [];
    let requestCount = 0;
    let currentStart = 0;
    const urlPath = `/valorant/v4/matches/${STATS_PLAYER_REGION.toLowerCase()}/pc/${encodeURIComponent(STATS_PLAYER_NAME)}/${encodeURIComponent(STATS_PLAYER_TAG)}`;
    
    log.info('STG', `Fetching match history for ${STATS_PLAYER_NAME}#${STATS_PLAYER_TAG}...`);

    while (requestCount < MAX_API_REQUESTS) {
        try {
            const queryParams = { mode: 'competitive', size: MAX_MATCHES_PER_REQUEST.toString(), start: currentStart.toString() };
            
            log.info('STG', `Request #${requestCount + 1}/${MAX_API_REQUESTS} with start=${currentStart}`);
            const response = await fetchFromHenrikApi(urlPath, queryParams);
            requestCount++;

            if (response.data && Array.isArray(response.data) && response.data.length > 0) {
                let reachedStopDate = false;
                for (const match of response.data) {
                    const gameStart = match.metadata && match.metadata.started_at ? new Date(match.metadata.started_at) : null;
                    if (gameStart && !isNaN(gameStart.getTime())) {
                        if (gameStart >= STOP_DATE) {
                            allMatches.push(match);
                        } else {
                            reachedStopDate = true;
                            break; 
                        }
                    }
                }
                
                if (reachedStopDate || response.data.length < MAX_MATCHES_PER_REQUEST) {
                    break;
                }
                
                currentStart += MAX_MATCHES_PER_REQUEST;
                await sleep(FETCH_INTERVAL);
            } else {
                break;
            }
        } catch (error) {
            log.error('STG', `Error fetching matches on request #${requestCount}: ${error.message}`);
            break;
        }
    }

    log.info('STG', `Fetched and processed a total of ${allMatches.length} matches since ${STOP_DATE.toISOString()}.`);
    allMatches.sort((a, b) => new Date(b.metadata.game_start_iso).getTime() - new Date(a.metadata.game_start_iso).getTime());
    return allMatches;
}

function processMatchData(jsonData) {
    const matches = jsonData.matches || [];
    const dailyStats = {};
    const rankedMatches = matches.filter(match => match.metadata.queue?.id === 'competitive');
    rankedMatches.forEach(match => {
        const date = formatInTimeZone(new Date(match.metadata.started_at), TIMEZONE, 'yyyy-MM-dd');
        if (!dailyStats[date]) {
            dailyStats[date] = { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0 };
        }
        const playerData = match.players.find(p => p.name === jsonData.player.name && p.tag === jsonData.player.tag);
        if (playerData) {
            dailyStats[date].matches++;
            dailyStats[date].kills += playerData.stats.kills;
            dailyStats[date].deaths += playerData.stats.deaths;
            const winningTeam = match.teams.find(t => t.won);
            if (winningTeam && winningTeam.team_id === playerData.team_id) {
                dailyStats[date].wins++;
            } else {
                dailyStats[date].losses++;
            }
        }
    });
    return dailyStats;
}

function generateHTML(dailyStats, playerInfo) {
    const dates = Object.keys(dailyStats).sort();
    const dateToLabelMap = {};
    let dayCounter = 1;
    dates.forEach(date => { if (date >= START_DATE_FOR_LABELS) { dateToLabelMap[date] = `Dzień ${dayCounter}`; dayCounter++; } });
    const chartLabels = dates.map(date => dateToLabelMap[date] || date);
    const rankedMatches = Object.values(dailyStats).reduce((sum, day) => sum + day.matches, 0);
    const totalWins = Object.values(dailyStats).reduce((sum, day) => sum + day.wins, 0);
    const totalKills = Object.values(dailyStats).reduce((sum, day) => sum + day.kills, 0);
    const totalDeaths = Object.values(dailyStats).reduce((sum, day) => sum + day.deaths, 0);
    const overallWinRate = rankedMatches > 0 ? ((totalWins / rankedMatches) * 100).toFixed(1) : 0;
    const overallKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : 0;
    let bestKdDay = { value: -1, label: 'Brak danych' }, bestWinRateDay = { value: -1, label: 'Brak danych' }, mostKillsDay = { value: -1, label: 'Brak danych' }, mostWinsDay = { value: -1, label: 'Brak danych' }, mostMatchesDay = { value: -1, label: 'Brak danych' };
    dates.forEach(date => {
        const day = dailyStats[date], label = dateToLabelMap[date] || date, currentKd = day.deaths > 0 ? (day.kills / day.deaths) : 0, currentWinRate = day.matches > 0 ? (day.wins / day.matches) * 100 : 0;
        if (currentKd > bestKdDay.value) bestKdDay = { value: currentKd, label: label };
        if (currentWinRate > bestWinRateDay.value) bestWinRateDay = { value: currentWinRate, label: label };
        if (day.kills > mostKillsDay.value) mostKillsDay = { value: day.kills, label: label };
        if (day.wins > mostWinsDay.value) mostWinsDay = { value: day.wins, label: label };
        if (day.matches > mostMatchesDay.value) mostMatchesDay = { value: day.matches, label: label };
    });
    const totalLosses = rankedMatches - totalWins;
    const wdlBalance = `${totalWins}W / ${totalLosses}L`;

    const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>@Szzalony | Statystyki Przedłużanego</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A==" crossorigin="anonymous" referrerpolicy="no-referrer" /><script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script><style>
    :root {
        --valorant-red: #ff4655;
        --valorant-dark: #0f1923;
        --valorant-card-bg: rgba(15, 25, 35, 0.75);
        --text-primary: #ece8e1;
        --text-secondary: #9ca3af;
        --border-color: rgba(255, 70, 85, 0.3);
        --green-glow: #4ade80;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Inter', sans-serif;
        background-color: var(--valorant-dark);
        background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
        background-size: 30px 30px;
        color: var(--text-primary);
        min-height: 100vh;
        padding: 20px;
        backdrop-filter: blur(2px);
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
        text-align: center; margin-bottom: 20px; padding: 40px; background: transparent;
    }
    .header h1 {
        font-family: 'Anton', sans-serif;
        font-size: 3.5rem;
        font-weight: 400;
        text-transform: uppercase;
        color: var(--valorant-red);
        margin-bottom: 12px;
        letter-spacing: 2px;
        text-shadow: 0 0 10px rgba(255, 70, 85, 0.5);
    }
    .player-info { font-size: 1.2rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; }
    .social-icons { margin-top: 25px; display: flex; justify-content: center; gap: 25px; }
    .social-icons a { color: var(--text-secondary); font-size: 1.6rem; transition: all .3s ease; }
    .social-icons a:hover { color: var(--valorant-red); transform: translateY(-3px); }
    .section-title {
        font-family: 'Anton', sans-serif;
        text-align: center; font-size: 2.5rem; font-weight: 400; text-transform: uppercase; letter-spacing: 1px; margin: 60px 0 30px 0; color: var(--text-primary);
    }
    .summary-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .stat-card {
        background: var(--valorant-card-bg);
        padding: 30px;
        text-align: center;
        border: 1px solid var(--border-color);
        clip-path: polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%);
        transition: background 0.3s ease, transform 0.3s ease;
        position: relative;
    }
    .stat-card:hover { background: rgba(35, 45, 55, 0.85); transform: translateY(-5px); }
    .stat-value { font-size: 2.5rem; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
    .stat-value-highlight { color: var(--valorant-red); }
    .stat-label { font-size: 1rem; color: var(--text-secondary); font-weight: 500; text-transform: uppercase; }
    .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(550px, 1fr)); gap: 25px; margin-bottom: 30px; }
    .chart-container { background: var(--valorant-card-bg); padding: 25px; border: 1px solid var(--border-color); backdrop-filter: blur(10px); height: 450px; }
    .chart-title {
        font-family: 'Anton', sans-serif; font-size: 1.5rem; letter-spacing: 1px; margin-bottom: 20px; text-align: center; font-weight: 400;
    }
    .footer { text-align: center; margin-top: 60px; padding: 20px; color: #6b7280; font-size: .9rem; }
    .rank-panel {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 30px; padding: 30px; margin-top: 30px; background: var(--valorant-card-bg); border-top: 2px solid var(--valorant-red); border-bottom: 2px solid var(--valorant-red);
    }
    .rank-icon img { width: 120px; height: 120px; filter: drop-shadow(0 0 15px rgba(255, 70, 85, 0.4)); }
    .rank-details { text-align: left; }
    .rank-name { font-size: 2.2rem; font-weight: 700; text-transform: uppercase; color: var(--text-primary); }
    .rank-rr { font-size: 1.2rem; color: var(--text-secondary); margin-top: 5px; }
    .rr-change { font-weight: 600; }
    .rr-change-positive { color: var(--green-glow); }
    .rr-change-negative { color: var(--valorant-red); }
    .progress-bar-wrapper { display: flex; align-items: center; gap: 10px; margin-top: 15px; }
    .progress-bar { width: 100%; max-width: 250px; height: 4px; background-color: rgba(255, 255, 255, 0.2); overflow: hidden; }
    .progress-bar-inner { height: 100%; background: var(--valorant-red); }
    .peak-rank-icon { width: 28px; height: 28px; margin-left: 4px; }
    @media (max-width: 1200px) { .charts-grid { grid-template-columns: 1fr; } }
    @media (max-width: 600px) { .header h1 { font-size: 2.5rem; } .summary-stats { grid-template-columns: 1fr; } .stat-value { font-size: 2rem; } .charts-grid { grid-template-columns: 1fr; } .rank-panel { flex-direction: column; text-align: center; } .rank-details { text-align: center; } }
    </style></head><body><div class="container"><div class="header"><h1>STATYSTYKI PRZEDŁUŻANEGO</h1><div class="player-info">STREAM @ SZZALONY • <a href="https://tracker.gg/valorant/profile/riot/${playerInfo.name}%23${playerInfo.tag}/overview">${playerInfo.name}#${playerInfo.tag}</a></div><div class="social-icons"><a href="https://x.com/SzalonyVal" target="_blank" rel="noopener noreferrer" title="Twitter"><i class="fa-brands fa-twitter"></i></a><a href="https://www.instagram.com/szzalony/" target="_blank" rel="noopener noreferrer" title="Instagram"><i class="fa-brands fa-instagram"></i></a><a href="https://www.tiktok.com/@szalonyval_" target="_blank" rel="noopener noreferrer" title="TikTok"><i class="fa-brands fa-tiktok"></i></a><a href="https://www.youtube.com/channel/UCSHydsffEFN8KlLTZfCUDLg" target="_blank" rel="noopener noreferrer" title="YouTube"><i class="fa-brands fa-youtube"></i></a><a href="https://discord.gg/szalony" target="_blank" rel="noopener noreferrer" title="Discord"><i class="fa-brands fa-discord"></i></a></div></div><div id="rank-panel-placeholder" class="rank-panel"><p>Ładowanie rangi...</p></div><h2 class="section-title">Statystyki Ogólne</h2><div class="summary-stats"><div class="stat-card"><div class="stat-value">${rankedMatches}</div><div class="stat-label">Łącznie rankedów</div></div><div class="stat-card"><div class="stat-value stat-value-highlight">${overallWinRate}%</div><div class="stat-label">Łączny Win Rate</div></div><div class="stat-card"><div class="stat-value stat-value-highlight">${overallKD}</div><div class="stat-label">Łączne K/D</div></div><div class="stat-card"><div class="stat-value">${totalKills}</div><div class="stat-label">Killi</div></div><div class="stat-card"><div class="stat-value">${wdlBalance}</div><div class="stat-label">Bilans W/L</div></div></div><h2 class="section-title">Najlepsze Osiągnięcia Dzienne</h2><div class="summary-stats"><div class="stat-card"><div class="stat-value">${mostMatchesDay.value}</div><div class="stat-label">Meczy (${mostMatchesDay.label})</div></div><div class="stat-card"><div class="stat-value stat-value-highlight">${bestWinRateDay.value.toFixed(1)}%</div><div class="stat-label">Win Rate (${bestWinRateDay.label})</div></div><div class="stat-card"><div class="stat-value stat-value-highlight">${bestKdDay.value.toFixed(2)}</div><div class="stat-label">K/D (${bestKdDay.label})</div></div><div class="stat-card"><div class="stat-value">${mostKillsDay.value}</div><div class="stat-label">Killi (${mostKillsDay.label})</div></div><div class="stat-card"><div class="stat-value">${mostWinsDay.value}</div><div class="stat-label">Wygranych (${mostWinsDay.label})</div></div></div><h2 class="section-title">Wykresy dzienne</h2><div class="charts-grid"><div class="chart-container"><h3 class="chart-title">Dzienny Win Rate</h3><canvas id="winrateChart" class="chart-canvas"></canvas></div><div class="chart-container"><h3 class="chart-title">Dzienne K/D Ratio</h3><canvas id="kdChart" class="chart-canvas"></canvas></div><div class="chart-container"><h3 class="chart-title">Dzienne Kille vs Śmierci</h3><canvas id="killsDeathsChart" class="chart-canvas"></canvas></div><div class="chart-container"><h3 class="chart-title">Dziennie zagranych meczy</h3><canvas id="matchesChart" class="chart-canvas"></canvas></div></div><div class="footer">Stworzone z ❤️ przez <a style="decoration: none; color: white;" href="https://github.com/mkornela">deem</a><br />Wygenerowano ${new Date().toLocaleString('pl-PL')} • Dane pokrywają ${dates.length} dni</div></div><script>
        const TIER_ICONS = ${JSON.stringify(TIER_ICONS)};
        document.addEventListener('DOMContentLoaded', () => {
            const placeholder = document.getElementById('rank-panel-placeholder');
            fetch('https://api.valo.lol/api/rank').then(response => { if (!response.ok) { throw new Error(\`Network response was not ok, status: \${response.status}\`); } return response.json(); }).then(data => {
                if (data && data.current_data && data.current_data.currenttierpatched) {
                    const currentRankData = data.current_data;
                    const tierId = currentRankData.currenttier;
                    const tierName = currentRankData.currenttierpatched;
                    const rr = currentRankData.ranking_in_tier;
                    const lastChange = currentRankData.mmr_change_to_last_game;
                    
                    const progress = tierName === 'Immortal 3' ? (rr / 550) * 100 : (rr / 100) * 100;
                    
                    const rankPanelHtml = \`<div class="rank-icon"><img src="\${TIER_ICONS[tierId] || ''}" alt="\${tierName || 'Unknown Rank'}"></div><div class="rank-details"><div class="rank-name">\${tierName || 'Brak Danych'}</div><div class="rank-rr">\${rr} RR <span class="rr-change \${lastChange >= 0 ? 'rr-change-positive' : 'rr-change-negative'}">(\${lastChange >= 0 ? '+' : ''}\${lastChange})</span></div><div class="progress-bar-wrapper"><div class="progress-bar"><div class="progress-bar-inner" style="width: \${progress}%"></div></div></div></div>\`;
                    placeholder.innerHTML = rankPanelHtml;
                } else { placeholder.innerHTML = '<p>Nie udało się załadować danych o randze. API zwróciło niekompletne dane.</p>'; }
            }).catch(error => { console.error('Error fetching rank data:', error); placeholder.innerHTML = '<p>Wystąpił błąd podczas ładowania danych o randze.</p>'; });
        });
        const chartLabels = ${JSON.stringify(chartLabels)}, dailyStats = ${JSON.stringify(dailyStats)}, dates = ${JSON.stringify(dates)};
        Chart.defaults.borderColor='rgba(255,255,255,0.1)';Chart.defaults.color='#9ca3af';
        const chartOptions={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#f9fafb'}}},scales:{x:{grid:{color:'rgba(255,255,255,0.1)'},ticks:{color:'#9ca3af'}},y:{grid:{color:'rgba(255,255,255,0.1)'},ticks:{color:'#9ca3af'},beginAtZero:true}}};
        new Chart(document.getElementById('winrateChart'),{type:'line',data:{labels:chartLabels,datasets:[{label:'Win Rate (%)',data:dates.map(d=>dailyStats[d].matches>0?((dailyStats[d].wins/dailyStats[d].matches)*100).toFixed(1):0),borderColor:'#00c8c8',backgroundColor:'rgba(0,200,200,0.1)',fill:true,tension:0.4}]},options:{...chartOptions,scales:{...chartOptions.scales,y:{...chartOptions.scales.y,min:0,max:100}}}});
        new Chart(document.getElementById('kdChart'),{type:'line',data:{labels:chartLabels,datasets:[{label:'K/D',data:dates.map(d=>dailyStats[d].deaths>0?(dailyStats[d].kills/dailyStats[d].deaths).toFixed(2):0),borderColor:'#ff4655',backgroundColor:'rgba(255,70,85,0.1)',fill:true,tension:0.4}]},options:chartOptions});
        new Chart(document.getElementById('killsDeathsChart'),{type:'line',data:{labels:chartLabels,datasets:[{label:'Kille',data:dates.map(d=>dailyStats[d].kills),borderColor:'#4ade80',fill:false,tension:0.4},{label:'Śmierci',data:dates.map(d=>dailyStats[d].deaths),borderColor:'#ff4655',fill:false,tension:0.4}]},options:chartOptions});
        new Chart(document.getElementById('matchesChart'),{type:'bar',data:{labels:chartLabels,datasets:[{label:'Zagrane gry',data:dates.map(d=>dailyStats[d].matches),backgroundColor:'rgba(255,70,85,0.7)',borderColor:'#ff4655',borderWidth:1}]},options:{...chartOptions,scales:{...chartOptions.scales,y:{...chartOptions.scales.y,ticks:{...chartOptions.scales.y.ticks,stepSize:1}}}}});
    </script></body></html>`;
    return html;
}

async function generateAndSaveStats() {
    log.info('STG', 'Starting stats generation process...');
    try {
        await initFetch(); 
        
        const matches = await fetchAllMatchesUntilDate();
        if (matches.length === 0) {
            fs.writeFileSync(OUTPUT_FILE_NAME, "<h1>Nie znaleziono żadnych meczy od wyznaczonej daty.</h1>");
            log.warn('STG', 'No matches found since the stop date. An informational file was created.');
            return;
        }
        const playerInfo = { name: STATS_PLAYER_NAME, tag: STATS_PLAYER_TAG, region: STATS_PLAYER_REGION };
        const jsonData = { player: playerInfo, matches: matches };
        const dailyStats = processMatchData(jsonData);
        const htmlContent = generateHTML(dailyStats, playerInfo);
        fs.writeFileSync(OUTPUT_FILE_NAME, htmlContent, 'utf-8');
        log.info('STG', '✅ Static HTML file has been successfully generated and saved.');
    } catch (error) {
        log.error('STG', 'Critical error during stats generation.', error);
        fs.writeFileSync(OUTPUT_FILE_NAME, `<h1>Wystąpił krytyczny błąd podczas generowania statystyk: ${error.message}</h1>`, 'utf-8');
    }
}

module.exports = { generateAndSaveStats };