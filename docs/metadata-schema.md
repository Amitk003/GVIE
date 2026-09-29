# Metadata schema

We use 10 Cloudinary structured metadata fields. Names never change.

- proj_id: which project owns the file. Single select from a fixed list.
- veri_status: Verified, Pending_AI, Flagged_Location, Failed_C2PA. Controls who sees what.
- c2pa_valid: true only when signature check passes. Starts false.
- geo_coords: lat and long as text like 12.97, 77.59. Must match map regex.
- tempo_phase: Baseline_Before, Interim_Work, Outcome_After. Tells where the file sits in time.
- base_asset_id: public_id of the before file linked to this after file.
- ndvi_delta: plant cover change from -1 to 1.
- obj_count: count of units like panels or saplings. Zero or more.
- iqa_score: clarity from 0 to 1. Low means ask for a new photo.
- impact_summary: short plain text up to 1000 chars.

Rules: bad GPS is blocked, low score needs review, after photo needs a baseline link, failed signature never shows in public view.
