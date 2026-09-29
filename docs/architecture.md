# Architecture

GVIE is a set of small services around Cloudinary. Cloudinary stores files and builds images and videos. Our code checks truth and reads numbers.

## Flow

Field app -> API -> Cloudinary upload -> webhook -> queue -> align service -> telemetry worker -> metadata write -> search -> dashboard and video

## Parts

* Web app: upload page, review queue, project view, video page
* API: signs uploads, gets webhooks, talks to Cloudinary Admin and Search APIs
* Align service: Python FastAPI with OpenCV. Finds same points in two photos and warps the new one to the old view.
* Telemetry worker: calls Analyze API with a fixed schema, checks the JSON, writes back clean fields
* Schemas package: one place for field names, rules, and JSON schemas
* Cloudinary package: sign, verify, search, and build URLs
* Infra: scripts and Terraform to make envs the same each time

## Why this way

* Async queue keeps us safe when many files come at once and Cloudinary limits calls
* No video server. Video is just a smart URL with splice and text.
* One schema means web, API, and workers never mix field names.
