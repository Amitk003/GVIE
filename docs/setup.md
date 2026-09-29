# Setup

This guide helps you run GVIE on your laptop.

## What you need

- Node 20 or more
- Python 3.11
- Git
- A free Cloudinary account

## Steps

1. Clone the repo

```bash
git clone https://github.com/Amitk003/GVIE.git
cd GVIE
```

2. Copy env file

```bash
cp .env.example .env
```

3. Fill these values in `.env`

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- CLOUDINARY_UPLOAD_PRESET
- DATABASE_URL
- REDIS_URL

4. Install tools

```bash
npm install
pip install -r services/align/requirements-dev.txt
```

5. Make the Cloudinary metadata fields

This is the step people forget. Without these fields there is nowhere to put the
numbers. See it first with a dry run.

```bash
npm run metadata:apply --workspace @gvie/schemas -- --dry-run
npm run metadata:apply --workspace @gvie/schemas
```

Running it twice is safe. It keeps whatever is already there.

6. Start all apps

```bash
npm run dev
```

## Check it works

- Web: http://localhost:3000
- API health: http://localhost:4000/health
- Align health: http://localhost:5001/health
- Upload a test photo and see `veri_status` set to `Pending_AI`

## Check the build is clean

```bash
npm run test --workspaces --if-present
npm run lint
npm run format:check
cd services/align && python -m pytest
```

The same commands run on every pull request through `.github/workflows/checks.yml`.

## Common issues

- Wrong Cloudinary key: you get 401. Copy keys again from Cloudinary console.
- Webhook fails on localhost: use a tunnel like ngrok and set WEBHOOK_URL.
- Python OpenCV missing: run `pip install opencv-python-headless numpy fastapi uvicorn`.
