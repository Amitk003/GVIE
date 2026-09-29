# Security

* Signed uploads only. No unsigned preset in prod.
* Webhook signature is checked on each call.
* c2pa_valid starts false. Only the verify step can set true.
* Failed_C2PA files never show in public search.
* Private files use signed URLs with short life.
* Secrets live in env or vault, never in code.
* Hash each file with SHA-256 and store it in context for audit.
