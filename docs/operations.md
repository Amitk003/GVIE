# Operations

## Envs

dev, staging, prod are separate Cloudinary product envs and separate AWS accounts.

## Deploy

* Web on Vercel or Amplify
* API on Fargate or EC2 with PM2
* Align on Lambda with container image for OpenCV
* Worker on BullMQ with Redis

## Watch

* Track ingest to index lag, align time, telemetry time, search time
* Alert on webhook fail, queue growth, low schema pass rate
* Keep dead letter queue and replay button

## Cost

* Watch Analyze calls, transform counts, and bandwidth
* Archive raw files after one year, keep aligned and reels
