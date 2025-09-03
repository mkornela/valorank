# Valorank - Real-time VALORANT Stats API & Tracker

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/mkornela/valorank/blob/main/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/mkornela/valorank)](https://github.com/mkornela/valorank/commits/main)
[![Repo size](https://img.shields.io/github/repo-size/mkornela/valorank)](https://github.com/mkornela/valorank)
![Powered by](https://img.shields.io/badge/Powered%20by-HenrikDev%20API-blueviolet)

**Valorank** is a versatile Node.js backend application designed to track and serve real-time VALORANT statistics. It's perfect for streamers who want to display dynamic stats on their overlays, or for players who wish to track their progress with a custom solution.

The application provides flexible API endpoints and generates static HTML pages for advanced data visualization.

## ✨ Key Features

- **Flexible API**: Provides endpoints for tracking Win/Loss, rank information, RR, and session progress
- **Customizable Outputs**: Most endpoints allow for personalization of the text response format
- **Enhanced Performance**: Built-in caching mechanism for faster response times
- **VLR.gg Integration**: Fetches upcoming and daily match schedules for esports events
- **Stats Page Generator**: Automatically creates a detailed, static HTML page (`/statystyki`) with daily charts and statistics for a configured player
- **Documentation Generator**: Automatically generates clean API documentation from a configuration file
- **Discord Logging**: Sends notifications about server status, errors, and important events to a Discord webhook
- **Cron Jobs**: Automatically refreshes statistics at scheduled times
- **Local Leaderboard**: Utilizes a local `leaderboard.json` file for fast lookups of top-ranked players without constant API calls
- **Clean Project Structure**: The application logic is neatly organized into services, routes, utilities, and middleware
- **Comprehensive Error Handling**: Robust validation and error handling with consistent response formats

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Scheduled Tasks**: `node-cron`
- **Date Formatting**: `Day.js`, `date-fns-tz`
- **Console Logging**: `picocolors`
- **Environment Variables**: `dotenv`
- **Caching**: `node-cache`
- **API Documentation**: `swagger-jsdoc`, `swagger-ui-express`
- **Security**: `helmet`, `cors`, `express-rate-limit`

## 🚀 Getting Started

To run this project locally, follow the steps below.

### Prerequisites

- Node.js (version 16.x or newer recommended)
- npm

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mkornela/valorank.git
    cd valorank
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    Create a `.env` file in the root directory of the project. You can copy the contents from `.env.example` or create it from scratch.

    ```ini
    # Server Configuration
    PORT=7312
    NODE_ENV=production

    # API Key (Required)
    HENRIKDEV_API_KEY="your_henrikdev_api_key_here"

    # Player for the /statystyki page
    STATS_PLAYER_NAME="YourPlayerName"
    STATS_PLAYER_TAG="1234"
    STATS_PLAYER_REGION="eu"

    # Discord Integration (Optional)
    DISCORD_WEBHOOK_URL=""
    DISCORD_USER_ID_ON_ERROR=""

    # CORS Configuration (Optional)
    ALLOWED_ORIGINS="http://localhost:3000,https://yourdomain.com"
    ```

4.  **Prepare the leaderboard file:**
    The application requires a local `leaderboard.json` file for the `/getrank` endpoint to work.
    - Place your `leaderboard.json` file inside the `src/data/` directory
    - This file is **not** updated automatically. You must provide it yourself

5.  **Generate static files:**
    Before starting the server for the first time, you need to generate the HTML files for the documentation and stats pages.
    ```bash
    # Generates docs.html (the root page)
    npm run docs

    # Generates valorant_stats.html (the /statystyki page)
    npm run stats
    ```

6.  **Start the server:**
    ```bash
    npm start
    ```
    The server will be available at `http://localhost:7312` (or the port defined in your `.env` file).

## ⚙️ Configuration

All configuration variables are managed in the `.env` file:

- `PORT`: The port on which the server will run
- `NODE_ENV`: Environment (development/production)
- `HENRIKDEV_API_KEY`: Your API key from the [HenrikDev API](https://docs.henrikdev.xyz/). **This is required**
- `STATS_PLAYER_NAME`, `STATS_PLAYER_TAG`, `STATS_PLAYER_REGION`: The player data for whom the `/statystyki` page is generated
- `DISCORD_WEBHOOK_URL`: A Discord webhook URL for event logging
- `DISCORD_USER_ID_ON_ERROR`: A Discord user ID to be pinged in case of a critical error
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS

## 🔗 API Endpoints

Below is a summary of the main API endpoints. Full documentation is available on the root page (`/`) after starting the server.

| Endpoint                                | Method | Description                                                                 |
| --------------------------------------- | ------ | --------------------------------------------------------------------------- |
| `/wl/{name}/{tag}/{region}`             |  GET   | Returns the Win/Loss stats for the current session                         |
| `/advanced_wl/{name}/{tag}/{region}`    |  GET   | Returns W/L along with details about the last match (result & RR change)   |
| `/rank/{name}/{tag}/{region}`           |  GET   | Returns information about rank, RR, and progress to the next rank          |
| `/daily/{name}/{tag}/{region}`          |  GET   | Returns daily stats summary including rank, W/L, and RR change             |
| `/rankraw/{name}/{tag}/{region}`        |  GET   | Returns raw API data for a player without formatting                        |
| `/getrank/{position}`                   |  GET   | Returns information about a player at a specific leaderboard position      |
| `/nextmatch/{event}`                    |  GET   | Returns the next match for a specific esports event (VLR.gg data)          |
| `/dailymatches/{event}`                 |  GET   | Returns all today's matches for a specific esports event (VLR.gg data)     |
| `/statystyki`                           |  GET   | Serves a full HTML page with advanced player statistics                   |
| `/health`                               |  GET   | Health check endpoint for monitoring                                       |
| `/status`                               |  GET   | Serves a status page with API availability visualization                    |
| `/api-docs`                             |  GET   | Interactive Swagger UI API documentation                                    |

## 🎯 New Features

### VLR.gg Integration
- **Match Scheduling**: Fetch upcoming and daily match schedules for various esports events
- **Event Tracking**: Track matches for specific tournaments like VCT, EMEA, etc.
- **Real-time Updates**: Get the latest match information directly from VLR.gg

### Enhanced Performance
- **Caching System**: Built-in caching reduces API calls and improves response times
- **Optimized Routes**: Refactored route handlers with better error handling and validation
- **Middleware**: Reusable validation and response handling middleware

### Improved Documentation
- **Comprehensive API Docs**: Updated documentation with all new endpoints
- **Interactive Swagger UI**: Explore and test API endpoints interactively
- **Better Examples**: Clear request/response examples for all endpoints

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.
1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

This project is distributed under the MIT License. See the `LICENSE` file for more information.

## 🙏 Acknowledgements

-   A huge thanks to [**Henrik**](https://github.com/Henrik-3) for creating and maintaining the incredible [HenrikDev API](https://henrikdev.xyz/), which is the foundation of this project
-   Thanks to [**VLR.gg**](https://www.vlr.gg/) for providing comprehensive esports data and match information