const axios = require('axios');
const cheerio = require('cheerio');
const { VlrClient } = require('vlr-client');
const log = require('../utils/logger');

const BASE_URL = 'https://www.vlr.gg';
const vlr = new VlrClient();

async function fetchPage(url) {
    const startTime = Date.now();
    try {
        log.debug('VLR', `Fetching page: ${url}`, { url, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
        
        const { data, status, statusText, headers } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        
        const duration = Date.now() - startTime;
        log.debug('VLR', `Successfully fetched page: ${url}`, { 
            url, 
            status, 
            statusText, 
            duration,
            contentLength: data ? data.length : 0,
            contentType: headers['content-type']
        });
        
        return cheerio.load(data);
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorDetails = {
            url,
            duration,
            error: {
                message: error.message,
                code: error.code,
                response: error.response ? {
                    status: error.response.status,
                    statusText: error.response.statusText
                } : null
            }
        };
        
        log.error('VLR', `Failed to fetch page: ${url}`, error, errorDetails);
        return null;
    }
}

async function getUpcomingMatches() {
    const startTime = Date.now();
    try {
        log.debug('VLR', 'Getting upcoming matches from VLR client');
        
        const matches = await vlr.getUpcomingMatches();
        const duration = Date.now() - startTime;
        
        log.info('VLR', `Successfully retrieved upcoming matches`, { 
            count: matches.data ? matches.data.length : 0,
            duration,
            source: 'VLR client'
        });
        
        return matches;
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorDetails = {
            duration,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            fallback: 'Returning empty array'
        };
        
        log.error('VLR', 'Error getting upcoming matches from VLR client', error, errorDetails);
        return { data: [] };
    }
}

async function getMatchDetails(url) {
    const startTime = Date.now();
    try {
        log.debug('VLR', `Getting match details for: ${url}`, { url });
        
        const $ = await fetchPage(url);
        if (!$) {
            log.warn('VLR', `Failed to fetch match page: ${url}`, { url });
            return null;
        }

        const matchData = {};
        const header = $('.match-header');
        
        matchData.isLive = header.find('.match-header-vs-note.mod-live').text().trim().toUpperCase() === 'LIVE';
        
        const eventLink = header.find('a.match-header-event');
        const dateContainer = header.find('.match-header-date');

        matchData.event = {
            name: eventLink.find('div > div').first().text().trim() || 'N/A',
            subname: eventLink.find('.match-header-event-series').text().replace(/\s+/g, ' ').trim() || 'N/A',
            url: BASE_URL + (eventLink.attr('href') || '')
        };
        
        matchData.date = dateContainer.find('.moment-tz-convert').first().text().trim();
        matchData.hour = dateContainer.find('.moment-tz-convert').last().text().trim();
        
        const scoreElement = header.find('.match-header-vs-score .js-spoiler').first();
        const scoreText = scoreElement.find('span:not(.match-header-vs-score-colon)').map((i, el) => $(el).text().trim()).get();
        
        if (scoreText.length >= 2 && /^\d+$/.test(scoreText[0]) && /^\d+$/.test(scoreText[scoreText.length-1])) {
            matchData.score = `${scoreText[0]} - ${scoreText[scoreText.length-1]}`;
        } else {
            matchData.score = 'vs';
        }

        const team1Name = header.find('.wf-title-med').first().text().trim();
        const team2Name = header.find('.wf-title-med').last().text().trim();
        matchData.team1 = { 
            name: team1Name, 
            logo: 'https:' + (header.find('a.match-header-link').first().find('img').attr('src') || '') 
        };
        matchData.team2 = { 
            name: team2Name, 
            logo: 'https:' + (header.find('a.match-header-link').last().find('img').attr('src') || '') 
        };

        const statsContainer = $('.vm-stats-game[data-game-id="all"]');
        [matchData.team1, matchData.team2].forEach((team, index) => {
            team.players = [];
            const tableBody = statsContainer.find('tbody').eq(index);
            tableBody.find('tr').each((i, row) => {
                const playerCells = $(row).find('td');
                if (playerCells.length === 0) return;

                const playerInfoCell = $(playerCells[0]);
                const nameAndAbbr = playerInfoCell.find('a');
                const playerName = nameAndAbbr.find('div.text-of').text().trim();
                const teamAbbreviation = nameAndAbbr.find('div.ge-text-light').text().trim();

                const flagElement = playerInfoCell.find('i.flag');
                const countryName = flagElement.attr('title') || 'N/A';
                const flagClasses = (flagElement.attr('class') || '').split(' ');
                const countryCode = (flagClasses[1] || 'mod-un').split('-')[1];
                const flagLink = `${BASE_URL}/img/icons/flags/16/${countryCode}.png`;

                const getStat = (cellIndex) => $(playerCells[cellIndex]).find('.side.mod-both').text().trim();
                
                const player = {
                    name: playerName,
                    playerLink: BASE_URL + (nameAndAbbr.attr('href') || ''),
                    abbreviation: teamAbbreviation,
                    country: countryName,
                    flagLink: flagLink,
                    agentsPlayed: $(playerCells[1]).find('img').map((i, agentEl) => $(agentEl).attr('title')).get(),
                    stats: {
                        Kills: getStat(4),
                        Deaths: $(playerCells[5]).find('.side.mod-both').text().trim(),
                        Assists: getStat(6),
                        ACS: getStat(3),
                        ADR: getStat(9),
                    }
                };
                team.players.push(player);
            });

            if (team.players.length > 0 && team.players[0].abbreviation) {
                team.abbreviation = team.players[0].abbreviation;
            } else {
                const teamNameContainer = header.find('.match-header-link-name').eq(index);
                team.abbreviation = teamNameContainer.find('div[style*="font-size: 12px"]').text().replace(/[()]/g, '').trim() || team.name.substring(0, 3).toUpperCase();
            }
        });

        const duration = Date.now() - startTime;
        log.info('VLR', `Successfully retrieved match details`, { 
            url,
            duration,
            teams: [matchData.team1?.name, matchData.team2?.name],
            isLive: matchData.isLive,
            playerCount: (matchData.team1?.players?.length || 0) + (matchData.team2?.players?.length || 0)
        });

        return matchData;
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorDetails = {
            url,
            duration,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        };
        
        log.error('VLR', `Error getting match details for: ${url}`, error, errorDetails);
        return null;
    }
}

async function getEvents() {
    const startTime = Date.now();
    try {
        log.debug('VLR', 'Getting events list');
        
        const $ = await fetchPage(`${BASE_URL}/events`);
        if (!$) {
            log.warn('VLR', 'Failed to fetch events page');
            return [];
        }

        const events = [];
        $('.event-item').each((i, el) => {
            const eventElement = $(el);
            const name = eventElement.find('.event-item-title').text().trim();
            const date = eventElement.find('.event-item-date').text().trim();
            const status = eventElement.find('.event-item-status').text().trim();
            const url = BASE_URL + (eventElement.attr('href') || '');
            
            if (name) {
                events.push({ name, date, status, url });
            }
        });
        
        const duration = Date.now() - startTime;
        log.info('VLR', `Successfully retrieved events list`, { 
            count: events.length,
            duration
        });
        
        return events;
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorDetails = {
            duration,
            url: `${BASE_URL}/events`,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        };
        
        log.error('VLR', 'Error getting events list', error, errorDetails);
        return [];
    }
}

async function getEventMatches(eventSlug) {
    const startTime = Date.now();
    try {
        log.debug('VLR', `Getting matches for event: ${eventSlug}`, { eventSlug });
        
        const $ = await fetchPage(`${BASE_URL}/events/${eventSlug}`);
        if (!$) {
            log.warn('VLR', `Failed to fetch event matches page: ${eventSlug}`, { eventSlug });
            return [];
        }

        const matches = [];
        $('.match-item').each((i, el) => {
            const matchElement = $(el);
            const time = matchElement.find('.match-item-time').text().trim();
            if (!time) return;

            const url = BASE_URL + (matchElement.attr('href') || '');
            const teamNodes = matchElement.find('.match-item-vs-team-name');
            const teams = [
                teamNodes.first().text().trim(),
                teamNodes.last().text().trim()
            ];
            const event = matchElement.find('.match-item-event').text().trim().replace(/\s+/g, ' ').split('\n')[0].trim();
            const status = matchElement.find('.match-item-status').text().trim();

            matches.push({ 
                teams, 
                time, 
                event, 
                status,
                url 
            });
        });
        
        const duration = Date.now() - startTime;
        log.info('VLR', `Successfully retrieved event matches`, { 
            eventSlug,
            count: matches.length,
            duration
        });
        
        return matches;
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorDetails = {
            duration,
            eventSlug,
            url: `${BASE_URL}/events/${eventSlug}`,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        };
        
        log.error('VLR', `Error getting matches for event: ${eventSlug}`, error, errorDetails);
        return [];
    }
}

async function searchPlayers(query) {
    const startTime = Date.now();
    try {
        log.debug('VLR', `Searching for players: ${query}`, { query });
        
        const $ = await fetchPage(`${BASE_URL}/search/?q=${encodeURIComponent(query)}&type=players`);
        if (!$) {
            log.warn('VLR', `Failed to fetch player search results: ${query}`, { query });
            return [];
        }

        const players = [];
        $('.search-item-player').each((i, el) => {
            const playerElement = $(el);
            const name = playerElement.find('.search-item-player-name').text().trim();
            const country = playerElement.find('.search-item-player-country').text().trim();
            const team = playerElement.find('.search-item-player-team').text().trim();
            const url = BASE_URL + (playerElement.attr('href') || '');
            
            if (name) {
                players.push({ name, country, team, url });
            }
        });
        
        const duration = Date.now() - startTime;
        log.info('VLR', `Successfully searched for players`, { 
            query,
            count: players.length,
            duration
        });
        
        return players;
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorDetails = {
            duration,
            query,
            url: `${BASE_URL}/search/?q=${encodeURIComponent(query)}&type=players`,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        };
        
        log.error('VLR', `Error searching for players: ${query}`, error, errorDetails);
        return [];
    }
}

module.exports = {
    getUpcomingMatches,
    getMatchDetails,
    getEvents,
    getEventMatches,
    searchPlayers
};