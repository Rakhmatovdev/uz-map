"""Build one PMTiles street package per Uzbekistan ADM1 region.

Input is Geofabrik's Shortbread MBTiles extract. Packages contain every vector
tile intersecting a region bounding box. The browser downloads one package and
keeps it in IndexedDB, so street rendering no longer needs a network connection.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import sqlite3
from pathlib import Path

from pmtiles.convert import mbtiles_to_header_json
from pmtiles.tile import zxy_to_tileid
from pmtiles.writer import write


def geometry_bounds(geometry: dict) -> tuple[float, float, float, float]:
    points: list[tuple[float, float]] = []

    def visit(value):
        if isinstance(value, list) and len(value) >= 2 and all(
            isinstance(item, (int, float)) for item in value[:2]
        ):
            points.append((value[0], value[1]))
        elif isinstance(value, list):
            for item in value:
                visit(item)

    visit(geometry["coordinates"])
    longitudes, latitudes = zip(*points)
    return min(longitudes), min(latitudes), max(longitudes), max(latitudes)


def lon_to_x(lon: float, zoom: int) -> int:
    return max(0, min((1 << zoom) - 1, int((lon + 180) / 360 * (1 << zoom))))


def lat_to_y(lat: float, zoom: int) -> int:
    lat = max(-85.05112878, min(85.05112878, lat))
    radians = math.radians(lat)
    value = (1 - math.asinh(math.tan(radians)) / math.pi) / 2 * (1 << zoom)
    return max(0, min((1 << zoom) - 1, int(value)))


def package_region(
    connection: sqlite3.Connection,
    metadata: dict,
    feature: dict,
    output: Path,
    max_zoom: int,
) -> dict:
    min_lon, min_lat, max_lon, max_lat = geometry_bounds(feature["geometry"])
    entries: list[tuple[int, int, int, int]] = []

    for zoom in range(int(metadata["minzoom"]), max_zoom + 1):
        x_min, x_max = lon_to_x(min_lon, zoom), lon_to_x(max_lon, zoom)
        y_min, y_max = lat_to_y(max_lat, zoom), lat_to_y(min_lat, zoom)
        tms_min = (1 << zoom) - 1 - y_max
        tms_max = (1 << zoom) - 1 - y_min
        rows = connection.execute(
            """
            SELECT tile_column, tile_row
            FROM tiles
            WHERE zoom_level = ?
              AND tile_column BETWEEN ? AND ?
              AND tile_row BETWEEN ? AND ?
            """,
            (zoom, x_min, x_max, tms_min, tms_max),
        )
        for x, tms_y in rows:
            y = (1 << zoom) - 1 - tms_y
            entries.append((zxy_to_tileid(zoom, x, y), zoom, x, tms_y))

    entries.sort(key=lambda item: item[0])
    output.parent.mkdir(parents=True, exist_ok=True)
    with write(str(output)) as writer:
        for tile_id, zoom, x, tms_y in entries:
            row = connection.execute(
                "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
                (zoom, x, tms_y),
            ).fetchone()
            if not row:
                continue
            data = row[0]
            if metadata.get("format") == "pbf" and data[:2] != b"\x1f\x8b":
                data = gzip.compress(data)
            writer.write_tile(tile_id, data)

        package_metadata = dict(metadata)
        package_metadata.update(
            {
                "bounds": f"{min_lon},{min_lat},{max_lon},{max_lat}",
                "center": f"{(min_lon + max_lon) / 2},{(min_lat + max_lat) / 2},8",
                "maxzoom": str(max_zoom),
                "name": feature["properties"]["shapeName"],
            }
        )
        header, package_metadata = mbtiles_to_header_json(package_metadata)
        writer.finalize(header, package_metadata)

    return {
        "iso": feature["properties"]["shapeISO"],
        "name": feature["properties"]["shapeName"],
        "file": output.name,
        "bytes": output.stat().st_size,
        "bounds": [min_lon, min_lat, max_lon, max_lat],
        "maxZoom": max_zoom,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mbtiles", type=Path)
    parser.add_argument("adm1", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--max-zoom", type=int, default=14)
    args = parser.parse_args()

    adm1 = json.loads(args.adm1.read_text(encoding="utf-8"))
    connection = sqlite3.connect(args.mbtiles)
    metadata = dict(connection.execute("SELECT name, value FROM metadata"))
    source_max_zoom = int(metadata["maxzoom"])
    max_zoom = min(args.max_zoom, source_max_zoom)
    manifest = []

    for feature in adm1["features"]:
        iso = feature["properties"]["shapeISO"]
        target = args.output / f"{iso.lower()}-streets.pmtiles"
        print(f"Building {iso} -> {target.name}", flush=True)
        manifest.append(package_region(connection, metadata, feature, target, max_zoom))

    connection.close()
    manifest_path = args.output / "offline-packages.json"
    manifest_path.write_text(
        json.dumps({"version": 1, "packages": manifest}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {manifest_path}", flush=True)


if __name__ == "__main__":
    main()
