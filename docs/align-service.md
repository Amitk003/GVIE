# Align service

This service lines up a new photo to its baseline.

## Steps in plain words

1. Get both files from Cloudinary
2. Find sharp points with SIFT in each photo
3. Match points with FLANN and keep good ones with Lowe test 0.75
4. Use RANSAC to drop wrong matches and find the warp matrix H
5. Warp the new photo with warpPerspective to the old view
6. Upload the warped file as aligned_id and link base_asset_id

## When it skips

* Less than 15 good matches
* Error more than 8 pixels
* View change more than 60 degrees

Then we keep the raw file, use smart crop g_auto, and set alignment_warning to true.

## URLs we build

* Split view: overlay aligned file with crop east half
* Wipe: small WebP that loops between two frames
