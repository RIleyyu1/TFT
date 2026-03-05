"""Configuration module — loads settings from .env and exposes constants."""

import os
from dotenv import load_dotenv

load_dotenv()

RIOT_API_KEY: str = os.getenv("RIOT_API_KEY", "")

# Platform routing (league / summoner endpoints)
PLATFORM_ROUTES: dict[str, str] = {
    "na1": "https://na1.api.riotgames.com",
    "euw1": "https://euw1.api.riotgames.com",
    "kr": "https://kr.api.riotgames.com",
}

# Regional routing (match endpoints)
REGIONAL_ROUTES: dict[str, str] = {
    "na1": "https://americas.api.riotgames.com",
    "euw1": "https://europe.api.riotgames.com",
    "kr": "https://asia.api.riotgames.com",
}

# Rate limit defaults (Development Key)
RATE_LIMIT_PER_SECOND: int = 20
RATE_LIMIT_PER_2MIN: int = 100

# Data Dragon
DDRAGON_VERSIONS_URL: str = "https://ddragon.leagueoflegends.com/api/versions.json"
DDRAGON_BASE_URL: str = "https://ddragon.leagueoflegends.com/cdn"
