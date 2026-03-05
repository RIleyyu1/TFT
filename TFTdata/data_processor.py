"""Data processing — transforms raw match JSON into clean CSV/JSON outputs."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)


class DataProcessor:
    """Cleans and transforms raw TFT match data into structured CSV/JSON files."""

    def __init__(self, output_dir: str = "./data"):
        self.output_dir = Path(output_dir)
        self.raw_dir = self.output_dir / "raw"
        self.processed_dir = self.output_dir / "processed"
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    def load_raw_matches(self) -> list[dict]:
        """Load all raw match JSON files from the raw directory."""
        matches = []
        for f in sorted(self.raw_dir.glob("*.json")):
            if f.name == "collected_ids.json":
                continue
            with open(f, "r") as fp:
                matches.append(json.load(fp))
        logger.info("Loaded %d raw match files", len(matches))
        return matches

    def process(self, matches: list[dict] | None = None) -> None:
        """Run the full processing pipeline."""
        if matches is None:
            matches = self.load_raw_matches()
        if not matches:
            logger.warning("No matches to process")
            return

        matches_rows: list[dict] = []
        participants_rows: list[dict] = []
        units_rows: list[dict] = []
        traits_rows: list[dict] = []
        augments_rows: list[dict] = []

        for match in matches:
            info = match.get("info", {})
            metadata = match.get("metadata", {})
            match_id = metadata.get("match_id", "")

            # -- matches table --
            game_datetime = info.get("game_datetime", 0)
            matches_rows.append(
                {
                    "match_id": match_id,
                    "game_datetime": datetime.fromtimestamp(
                        game_datetime / 1000, tz=timezone.utc
                    ).isoformat(),
                    "game_length": info.get("game_length", 0),
                    "game_version": info.get("game_version", ""),
                    "tft_set_number": info.get("tft_set_number", 0),
                }
            )

            # -- per participant --
            for participant in info.get("participants", []):
                puuid = participant.get("puuid", "")

                participants_rows.append(
                    {
                        "match_id": match_id,
                        "puuid": puuid,
                        "placement": participant.get("placement", 0),
                        "level": participant.get("level", 0),
                        "last_round": participant.get("last_round", 0),
                        "time_eliminated": participant.get("time_eliminated", 0),
                        "players_eliminated": participant.get("players_eliminated", 0),
                        "total_damage_to_players": participant.get("total_damage_to_players", 0),
                        "gold_left": participant.get("gold_left", 0),
                    }
                )

                # -- units --
                for unit in participant.get("units", []):
                    units_rows.append(
                        {
                            "match_id": match_id,
                            "puuid": puuid,
                            "character_id": unit.get("character_id", ""),
                            "tier": unit.get("tier", 0),
                            "rarity": unit.get("rarity", 0),
                            "items": json.dumps(unit.get("itemNames", unit.get("items", []))),
                        }
                    )

                # -- traits --
                for trait in participant.get("traits", []):
                    traits_rows.append(
                        {
                            "match_id": match_id,
                            "puuid": puuid,
                            "name": trait.get("name", ""),
                            "num_units": trait.get("num_units", 0),
                            "style": trait.get("style", 0),
                            "tier_current": trait.get("tier_current", 0),
                            "tier_total": trait.get("tier_total", 0),
                        }
                    )

                # -- augments --
                for order, augment in enumerate(participant.get("augments", []), start=1):
                    augments_rows.append(
                        {
                            "match_id": match_id,
                            "puuid": puuid,
                            "augment_name": augment,
                            "augment_order": order,
                        }
                    )

        # Write CSVs
        self._write_csv(matches_rows, "matches.csv")
        self._write_csv(participants_rows, "participants.csv")
        self._write_csv(units_rows, "units.csv")
        self._write_csv(traits_rows, "traits.csv")
        self._write_csv(augments_rows, "augments.csv")

        # Write summary stats
        self._write_summary(matches_rows, participants_rows)

        logger.info("Processing complete — files written to %s", self.processed_dir)

    def _write_csv(self, rows: list[dict], filename: str) -> None:
        """Write a list of dicts to a CSV file."""
        df = pd.DataFrame(rows)
        out_path = self.processed_dir / filename
        df.to_csv(out_path, index=False)
        logger.info("Wrote %s (%d rows)", filename, len(df))

    def _write_summary(self, matches_rows: list[dict], participants_rows: list[dict]) -> None:
        """Generate summary_stats.json."""
        datetimes = [r["game_datetime"] for r in matches_rows if r["game_datetime"]]
        summary = {
            "total_matches": len(matches_rows),
            "total_participant_records": len(participants_rows),
            "date_range": {
                "earliest": min(datetimes) if datetimes else None,
                "latest": max(datetimes) if datetimes else None,
            },
        }
        out_path = self.processed_dir / "summary_stats.json"
        with open(out_path, "w") as f:
            json.dump(summary, f, indent=2)
        logger.info("Wrote summary_stats.json")
