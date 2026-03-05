"""Entry point — CLI interface for the TFT data collection pipeline."""

import argparse
import logging
import sys

from collector import TFTCollector
from data_processor import DataProcessor


def setup_logging(output_dir: str) -> None:
    """Configure logging: INFO to console, DEBUG to file."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # Console handler — INFO
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S"))
    root.addHandler(console)

    # File handler — DEBUG
    file_handler = logging.FileHandler(f"{output_dir}/collector.log", encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s [%(name)s] %(levelname)s %(message)s")
    )
    root.addHandler(file_handler)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="TFT Data Collector — collect high-elo match data from Riot API"
    )
    parser.add_argument(
        "--tiers",
        nargs="+",
        default=["challenger", "grandmaster", "master"],
        choices=["challenger", "grandmaster", "master"],
        help="Which ranked tiers to pull seed players from (default: all three)",
    )
    parser.add_argument(
        "--region",
        default="na1",
        choices=["na1", "euw1", "kr"],
        help="Platform region (default: na1)",
    )
    parser.add_argument(
        "--match-count",
        type=int,
        default=1000,
        help="Number of unique matches to collect (default: 1000)",
    )
    parser.add_argument(
        "--output-dir",
        default="./data",
        help="Output directory (default: ./data)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from previously collected data",
    )
    parser.add_argument(
        "--download-static",
        action="store_true",
        help="Download Data Dragon static data (champion/item/trait mappings)",
    )
    parser.add_argument(
        "--process-only",
        action="store_true",
        help="Skip collection, only process existing raw data",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    setup_logging(args.output_dir)
    logger = logging.getLogger(__name__)

    logger.info("TFT Data Collector starting")
    logger.info("Region: %s | Tiers: %s | Target: %d matches", args.region, args.tiers, args.match_count)

    collector = TFTCollector(
        region=args.region,
        output_dir=args.output_dir,
        match_count=args.match_count,
        tiers=args.tiers,
        resume=args.resume,
    )

    # Optional: download static data
    if args.download_static:
        logger.info("Downloading Data Dragon static data...")
        collector.download_static_data()

    # Collect matches (or skip if --process-only)
    if not args.process_only:
        collector.collect()

    # Process raw data into CSVs
    logger.info("Processing raw data...")
    processor = DataProcessor(output_dir=args.output_dir)
    processor.process()

    logger.info("Done!")


if __name__ == "__main__":
    main()
