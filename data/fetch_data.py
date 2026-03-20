"""
fetch_data.py — TMDB Data Fetcher (Stub)
========================================

This script documents how to rebuild `franchises.json` from the TMDB API
if you have an API key. Currently, the project ships with pre-generated
synthetic data based on real box office knowledge. No API key is required
to run the visualization.

HOW TO REBUILD FROM TMDB
--------------------------
1. Obtain a free API key at https://www.themoviedb.org/settings/api
2. Set the environment variable:
       export TMDB_API_KEY="your_key_here"
3. Uncomment and run the code below.

TMDB ENDPOINTS USED
--------------------
- GET /movie/{movie_id}         → budget, revenue, runtime, vote_average, vote_count, genres, overview, release_date
- GET /search/movie             → find movie IDs by title
- GET /configuration            → base URL for poster_path images

FRANCHISE MOVIE IDs (TMDB)
---------------------------
Replace the placeholder IDs below with the real TMDB movie IDs for each franchise.
You can look these up at: https://www.themoviedb.org/

Example structure:
    FRANCHISE_MOVIE_IDS = {
        "mcu": [1726, 1724, 10138, 10195, ...],   # Iron Man, Incredible Hulk, Iron Man 2, Thor, ...
        "star-wars": [11, 1891, 1892, 1893, ...],  # ANH, ESB, RotJ, TPM, ...
        ...
    }

NOTES
-----
- TMDB data may differ slightly from real-world reported figures (e.g., budgets are often
  self-reported by studios and may be understated).
- poster_path values from TMDB are relative paths; prepend the base URL from /configuration.
- Rate limit: TMDB allows ~40 requests per 10 seconds on the free tier.
"""

# --- STUB: uncomment and fill in to activate ---

# import os
# import json
# import time
# import requests
#
# API_KEY = os.environ.get("TMDB_API_KEY")
# BASE_URL = "https://api.themoviedb.org/3"
#
# FRANCHISE_MOVIE_IDS = {
#     "mcu": [],       # Fill with TMDB IDs
#     "dceu": [],
#     "star-wars": [],
#     "harry-potter": [],
#     "james-bond": [],
#     "fast-furious": [],
#     "jurassic-park": [],
#     "pirates-caribbean": [],
#     "lotr-hobbit": [],
#     "transformers": [],
#     "mission-impossible": [],
#     "spider-man": [],
#     "batman": [],
#     "x-men": [],
#     "toy-story": [],
#     "indiana-jones": [],
# }
#
# def fetch_movie(movie_id):
#     url = f"{BASE_URL}/movie/{movie_id}?api_key={API_KEY}"
#     resp = requests.get(url)
#     resp.raise_for_status()
#     return resp.json()
#
# def build_franchises():
#     franchises = []
#     for franchise_id, movie_ids in FRANCHISE_MOVIE_IDS.items():
#         movies = []
#         for i, mid in enumerate(movie_ids, start=1):
#             data = fetch_movie(mid)
#             movies.append({
#                 "title": data["title"],
#                 "release_date": data["release_date"],
#                 "year": int(data["release_date"][:4]),
#                 "entry_number": i,
#                 "series": "main",
#                 "budget": data.get("budget", 0),
#                 "revenue": data.get("revenue", 0),
#                 "vote_average": data.get("vote_average", 0),
#                 "vote_count": data.get("vote_count", 0),
#                 "runtime": data.get("runtime", 0),
#                 "genres": [g["name"] for g in data.get("genres", [])],
#                 "poster_path": data.get("poster_path"),
#                 "overview": data.get("overview", ""),
#             })
#             time.sleep(0.25)  # stay within rate limit
#         franchises.append({
#             "id": franchise_id,
#             "name": franchise_id.replace("-", " ").title(),
#             "color": "#cccccc",  # override with correct franchise color
#             "movies": movies,
#         })
#     return {"franchises": franchises, "annotations": []}
#
# if __name__ == "__main__":
#     if not API_KEY:
#         raise ValueError("Set TMDB_API_KEY environment variable before running.")
#     output = build_franchises()
#     with open("franchises.json", "w") as f:
#         json.dump(output, f, indent=2)
#     print("franchises.json written successfully.")
