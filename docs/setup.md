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
pip install -r services/align/requirements.txt
```

5. Make Cloudinary metadata fields

```bash
npm run metadata:apply --workspace=packages/schemas
```

6. Start all apps

```bash
npm run dev
```

## Check it works

- Web: http://localhost:3000
- API docs: http://localhost:4000/docs
- Align health: http://localhost:5001/health
- Upload a test photo and see `veri_status` set to Pending_AI or Verified.

## Common issues

- Wrong Cloudinary key: you get 401. Copy keys again from Cloudinary console.
- Webhook fails on localhost: use a tunnel like ngrok and set WEBHOOK_URL.
- Python OpenCV missing: run `pip install opencv-python-headless numpy fastapi uvicorn`.
