"""Core data collection logic for TFT match data from Riot API."""

import json
import logging
import os
import time
from pathlib import Path
from typing import Optional

import requests

from config import (
    RIOT_API_KEY,
    PLATFORM_ROUTES,
    REGIONAL_ROUTES,
    DDRAGON_VERSIONS_URL,
    DDRAGON_BASE_URL,
)
from rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


class TFTCollector:
    """Collects TFT match data from the Riot Games API."""

    def __init__(
        self,
        region: str = "na1",
        output_dir: str = "./data",
        match_count: int = 1000,
        tiers: Optional[list[str]] = None,
        resume: bool = False,
    ):
        self.region = region
        self.platform_url = PLATFORM_ROUTES[region]
        self.regional_url = REGIONAL_ROUTES[region]
        self.output_dir = Path(output_dir)
        self.raw_dir = self.output_dir / "raw"
        self.match_count = match_count
        self.tiers = tiers or ["challenger", "grandmaster", "master"]
        self.resume = resume

        # Ensure directories exist
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        (self.output_dir / "processed").mkdir(parents=True, exist_ok=True)

        # Session and rate limiter
        self.session = requests.Session()
        self.session.headers.update({"X-Riot-Token": RIOT_API_KEY})
        self.rate_limiter = RateLimiter()

        # Tracking state
        self.collected_ids_path = self.output_dir / "collected_ids.json"
        self.collected_ids: set[str] = set()
        if self.resume:
            self._load_collected_ids()

    # ------------------------------------------------------------------
    # State persistence
    # ------------------------------------------------------------------

    def _load_collected_ids(self) -> None:
        """Load previously collected match IDs for resume support."""
        if self.collected_ids_path.exists():
            with open(self.collected_ids_path, "r") as f:
                self.collected_ids = set(json.load(f))
            logger.info("Resumed with %d previously collected matches", len(self.collected_ids))

    def _save_collected_ids(self) -> None:
        """Persist collected match IDs to disk."""
        with open(self.collected_ids_path, "w") as f:
            json.dump(sorted(self.collected_ids), f)

    # ------------------------------------------------------------------
    # API calls
    # ------------------------------------------------------------------

    def _get(self, url: str, params: Optional[dict] = None) -> dict | list:
        """Rate-limited GET request returning parsed JSON."""
        resp = self.rate_limiter.request(self.session, url, params=params)
        return resp.json()

    def get_league_entries(self, tier: str) -> list[dict]:
        """Fetch all summoner entries for a given tier (challenger/grandmaster/master)."""
        url = f"{self.platform_url}/tft/league/v1/{tier}"
        data = self._get(url)
        entries = data.get("entries", [])  # type: ignore[union-attr]
        logger.info("Fetched %d entries from %s", len(entries), tier)
        return entries

    def get_puuid(self, summoner_id: str) -> str:
        """Convert encrypted summonerId to PUUID via Summoner API."""
        url = f"{self.platform_url}/tft/summoner/v1/summoners/{summoner_id}"
        data = self._get(url)
        return data["puuid"]  # type: ignore[index]

    def get_match_ids(self, puuid: str, count: int = 20) -> list[str]:
        """Fetch recent match IDs for a player."""
        url = f"{self.regional_url}/tft/match/v1/matches/by-puuid/{puuid}/ids"
        data = self._get(url, params={"count": count})
        return data  # type: ignore[return-value]

    def get_match_detail(self, match_id: str) -> dict:
        """Fetch full match details."""
        url = f"{self.regional_url}/tft/match/v1/matches/{match_id}"
        return self._get(url)  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Static data (Data Dragon)
    # ------------------------------------------------------------------

    def download_static_data(self) -> None:
        """Download TFT static data (champions, items, traits) from Data Dragon."""
        static_dir = Path("static_data")
        static_dir.mkdir(exist_ok=True)

        # Get latest version
        versions = requests.get(DDRAGON_VERSIONS_URL).json()
        version = versions[0]
        logger.info("Using Data Dragon version: %s", version)

        endpoints = {
            "champions": f"{DDRAGON_BASE_URL}/{version}/data/en_US/tft-champion.json",
            "items": f"{DDRAGON_BASE_URL}/{version}/data/en_US/tft-item.json",
            "traits": f"{DDRAGON_BASE_URL}/{version}/data/en_US/tft-trait.json",
        }

        for name, url in endpoints.items():
            resp = requests.get(url)
            resp.raise_for_status()
            raw = resp.json()

            # Build id -> name mapping
            mapping: dict[str, str] = {}
            data_section = raw.get("data", {})
            for key, value in data_section.items():
                mapping[value.get("id", key)] = value.get("name", key)

            out_path = static_dir / f"{name}.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(mapping, f, indent=2, ensure_ascii=False)
            logger.info("Saved %s mapping (%d entries) to %s", name, len(mapping), out_path)

    # ------------------------------------------------------------------
    # Main collection pipeline
    # ------------------------------------------------------------------

    def collect(self) -> list[dict]:
        """Run the full collection pipeline. Returns list of match detail dicts."""
        if not RIOT_API_KEY:
            raise ValueError("RIOT_API_KEY not set. Copy .env.example to .env and add your key.")

        # Step 1: gather seed players from all requested tiers
        all_entries: list[dict] = []
        for tier in self.tiers:
            entries = self.get_league_entries(tier)
            for e in entries:
                e["_tier"] = tier
            all_entries.extend(entries)

        # Sort by LP descending — prioritize higher ranked players
        all_entries.sort(key=lambda e: e.get("leaguePoints", 0), reverse=True)
        logger.info("Total seed players: %d", len(all_entries))

        # Step 2: iterate players, collect matches
        matches: list[dict] = []
        start_time = time.time()
        target = self.match_count

        # Reload raw files already on disk when resuming
        if self.resume:
            for mid in list(self.collected_ids):
                raw_path = self.raw_dir / f"{mid}.json"
                if raw_path.exists():
                    with open(raw_path, "r") as f:
                        matches.append(json.load(f))

        if len(self.collected_ids) >= target:
            logger.info("Already have %d matches (target %d). Nothing to do.", len(self.collected_ids), target)
            return matches

        for idx, entry in enumerate(all_entries):
            if len(self.collected_ids) >= target:
                break

            # Modern Riot API returns puuid directly in league entries
            puuid = entry.get("puuid")
            if not puuid:
                # Fallback for older API versions using summonerId
                summoner_id = entry.get("summonerId")
                if not summoner_id:
                    continue
                try:
                    puuid = self.get_puuid(summoner_id)
                except requests.HTTPError as exc:
                    logger.warning("Failed to get PUUID for %s: %s", summoner_id, exc)
                    continue

            try:
                match_ids = self.get_match_ids(puuid, count=20)
            except requests.HTTPError as exc:
                logger.warning("Failed to get matches for PUUID %s: %s", puuid[:8], exc)
                continue

            new_ids = [mid for mid in match_ids if mid not in self.collected_ids]
            if not new_ids:
                continue

            for match_id in new_ids:
                if len(self.collected_ids) >= target:
                    break
                try:
                    detail = self.get_match_detail(match_id)
                except requests.HTTPError as exc:
                    logger.warning("Failed to get match %s: %s", match_id, exc)
                    continue

                # Save raw JSON
                raw_path = self.raw_dir / f"{match_id}.json"
                with open(raw_path, "w") as f:
                    json.dump(detail, f)

                matches.append(detail)
                self.collected_ids.add(match_id)
                self._save_collected_ids()

                # Progress
                elapsed = time.time() - start_time
                done = len(self.collected_ids)
                rate = done / elapsed if elapsed > 0 else 0
                eta = (target - done) / rate if rate > 0 else 0
                logger.info(
                    "[%d/%d] Collected %s | Player %d/%d | ETA %.0fs",
                    done,
                    target,
                    match_id,
                    idx + 1,
                    len(all_entries),
                    eta,
                )

        logger.info(
            "Collection complete: %d matches in %.0fs",
            len(self.collected_ids),
            time.time() - start_time,
        )
        return matches
