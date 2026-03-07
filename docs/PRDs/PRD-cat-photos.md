# PRD: Cat Photo Uploads

| | |
|---|---|
| **Status** | `Implemented` |
| **Author** | Product Owner |
| **Created** | 2026-03-07 |
| **Supersedes** | PRD-features-backlog.md §1a (Photo Upload) |

---

## Problem

Every cat card and profile page shows a generic cat emoji placeholder. The app tracks deeply personal health data about cats owners genuinely love — yet it has no face for those cats. Adding a real photo transforms Cat Tracker from a data logger into something that feels like it belongs on your phone alongside your family photos. The emotional connection also drives retention: owners who see their cat's face every time they open the app are far more likely to log measurements consistently.

---

## User Stories

1. **First upload**: "I just added Luna. I want to upload a photo so I can see her face on the home screen instead of a generic emoji."
2. **Face focus**: "I took a full-body photo but I want to zoom in so only her face shows in the circular avatar — she has such an expressive face."
3. **Changing a photo**: "I got a better photo of Mochi from last week. I want to swap the old one out."
4. **Removing a photo**: "The photo I uploaded doesn't really look like Gemini anymore. I'd rather have no photo than a bad one."
5. **Multiple display contexts**: "I want the photo to show up on the home screen, on the profile, and on the vet export so the vet knows which cat I'm talking about."
6. **Household member**: "My partner uploaded a photo of Kylo. I can see it when I open the app too."

---

## Scope

### In scope
- Upload a cat photo from the Add/Edit Cat form
- Upload or change a photo by tapping the avatar on the Cat Profile hero
- Client-side crop/zoom UI: circular preview, pinch-to-zoom / scroll-to-zoom, drag-to-pan, before upload
- Client-side image processing: resize + crop extracted to a square JPEG via Canvas API before sending
- Storage in Cloudflare R2 (public bucket)
- Remove/reset to emoji placeholder
- Photo displayed in: Home cat cards, Cat Profile hero, Add/Edit Cat form preview, Vet Export page
- Reusable `CatAvatar` component (photo with emoji fallback) used everywhere
- Photos are household-scoped: all members see the same photo for a cat

### Out of scope
- Video clips
- Multiple photos per cat / photo gallery
- Automatic face detection for crop centering (manual crop only)
- Photos on the Comparison Chart legend (size too small; initials fallback is sufficient)
- Image compression beyond Canvas quality setting (no WebAssembly encoder)
- Generating thumbnails server-side

---

## UX / UI Design

### Entry point 1: Add/Edit Cat form

The form currently has fields for name, breed, sex, etc. A photo upload control is added at the top of the form, before the name field:

```
+------------------------------------------+
|                                          |
|         [  🐱  ]                         |
|       (tap to add photo)                 |
|                                          |
|  Name: ______________________________    |
|  ...                                     |
```

- **No photo yet**: shows the 🐱 emoji in a dashed circular ring with the label "Add photo" below. Tapping opens the device file picker (accept: image/*).
- **Photo set**: shows the cropped circular photo. Below it: "Change photo" and "Remove" links side by side in small muted text.
- Tapping "Change photo" re-opens the file picker; after selecting, the crop modal appears.
- The photo upload is optional. The form can be saved with or without a photo.

### Entry point 2: Cat Profile hero (tap-to-edit)

The circular avatar in the Cat Profile hero is tappable when the user has at least Editor role (or is the owner):

- Tapping the avatar opens a small action sheet with two options: "Change photo" and (if a photo exists) "Remove photo".
- "Change photo" → file picker → crop modal → upload.
- This makes photo management feel natural from the place where users spend the most time.

### Crop/zoom modal

After the user selects a file, the crop modal appears as a full-screen overlay (not an inline panel — the photo needs room to work with):

```
+------------------------------------------+
| Cancel                         Save       |
+------------------------------------------+
|                                          |
|        [image with circular mask]        |
|                                          |
|   Pinch or scroll to zoom               |
|   Drag to reposition                    |
|                                          |
|   [--------o---------]  zoom slider     |
|                                          |
+------------------------------------------+
```

**Behavior:**
- The image is displayed centered in the available space with a fixed circular aperture (the "crop circle") overlaid.
- Outside the circle: 50% dark scrim so the user focuses on the circular region.
- The image (not the crop circle) moves and scales. The crop circle stays fixed at center.
- **Drag**: pan the image (touch drag or mouse drag).
- **Pinch**: zoom in/out (touch pinch gesture on mobile).
- **Scroll**: zoom in/out (mouse wheel on desktop).
- **Slider**: explicit zoom control; also reflects pinch/scroll position. Range 1× to 4×.
- Minimum zoom: image must fill the crop circle (no empty area inside the circle).
- On **Save**: Canvas API extracts the crop region, scales to 400×400px, encodes as JPEG (quality 0.85), and sends to the API. The modal closes and the avatar updates immediately from the local blob (no waiting for the upload to complete before showing a preview — optimistic UI).
- On **Cancel**: dismiss the modal, no upload, no change.

**Implementation note (no library):** The crop UI is implemented with a positioned `<div>` overlay and a `<canvas>` for extraction. State tracks: `scale` (1–4), `offsetX`, `offsetY` (pan offset in px at 1× scale). Rendering uses CSS `transform: translate(offsetX, offsetY) scale(scale)` on the `<img>` element inside the circular mask container. The canvas extraction reproduces the same transform via `ctx.drawImage()`. See Implementation Plan for details.

### Display locations

| Location | Size | Behavior when no photo |
|----------|------|------------------------|
| Home — cat card avatar | 56px circle | 🐱 emoji on themed gradient background |
| Cat Profile — hero avatar | 80px circle | 🐱 emoji on themed gradient background |
| Add/Edit Cat — form preview | 64px circle | Dashed ring + "Add photo" label |
| Vet Export (`/cats/:id/export`) | 64px circle (print) | 🐱 emoji (or omit section) |

All photo instances use `object-fit: cover` on an `<img>` clipped to a circle. Fallback always shows the 🐱 emoji centered in the same-sized circle with the same styling currently applied.

### CatAvatar component

A shared component covers all display contexts:

```tsx
<CatAvatar
  photoUrl={cat.photo_url}
  name={cat.name}
  size={56}            // px; used for width/height and border-radius
  className="..."      // optional extra classes
/>
```

- If `photoUrl` is set: renders `<img src={photoUrl} ... />` with `object-fit: cover`.
- If not: renders the 🐱 emoji div exactly as it is today.
- The existing avatar styling (health-status tinted ring, gradient background) is applied by the parent — `CatAvatar` is just the image/fallback content, not the ring.

---

## API Design

### Upload / replace photo

```
POST /api/cats/:id/photo
Content-Type: multipart/form-data
Body: field "photo" (image/jpeg, ≤2MB after client processing)

Response 200: { "photo_url": "https://pub-xxxx.r2.dev/cats/abc123/photo.jpg" }
```

- Requires: active household member with Editor role or above.
- Worker reads the multipart body, extracts the `photo` field, validates content-type is `image/jpeg` and size ≤ 2MB.
- Uploads to R2 at key `cats/{cat_id}/photo.jpg` (fixed key — re-uploading overwrites; no stale object accumulation).
- Sets `cats.photo_url` to the public R2 URL.
- Returns `{ photo_url }`.

### Remove photo

```
DELETE /api/cats/:id/photo

Response 200: { "ok": true }
```

- Requires: Editor role or above.
- Deletes the R2 object at `cats/{cat_id}/photo.jpg`.
- Sets `cats.photo_url = NULL` in D1.

---

## Infrastructure

### R2 bucket

- **Bucket name**: `cat-tracker-photos`
- **Access**: Public (no auth required to fetch photo URLs). Cat photos are not sensitive data.
- **Public domain**: Cloudflare assigns a `pub-<hash>.r2.dev` subdomain, or a custom domain (`photos.01j.me`) can be added later.
- **Object key scheme**: `cats/{cat_id}/photo.jpg` — one object per cat, overwritten on each upload.
- **CORS**: Not needed for reads (public bucket, cross-origin img fetch works). Worker handles all writes.

### wrangler.toml changes

```toml
[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "cat-tracker-photos"
```

### AppEnv changes

```typescript
// worker/src/types.ts
Bindings: {
  DB: D1Database
  PHOTOS: R2Bucket        // ← new
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  OAUTH_REDIRECT_BASE: string
  RESEND_API_KEY: string
}
```

### Database

No schema change needed. `cats.photo_url TEXT` already exists in the schema.

---

## Security Considerations

- **Authorization**: Upload and delete require Editor role (same as other cat mutations). A Viewer or Contributor cannot change a cat's photo.
- **Content-type validation**: Worker rejects any multipart upload where the `photo` field's content-type is not `image/jpeg`. The client always sends JPEG (Canvas encodes to JPEG); this is a belt-and-suspenders check.
- **Size limit**: Worker rejects bodies over 2MB. Client-side canvas encoding at 400×400px JPEG q0.85 will always be well under 100KB, so 2MB is a conservative server-side cap.
- **No server-side image parsing**: The Worker does not decode or inspect pixel data — it treats the blob as opaque bytes and writes directly to R2. This avoids any image-parsing vulnerabilities.
- **R2 public access**: Public R2 URLs are unguessable (bucket name + path is not secret, but the cat ID in the path is a random hex string — effectively unguessable). Acceptable for cat photos.
- **CSP update**: The `img-src` directive in the Worker's `Content-Security-Policy` header must include the R2 bucket domain (e.g. `https://pub-xxxx.r2.dev` or `https://photos.01j.me`). This must be updated when the bucket's public domain is known.

---

## Resolved Decisions

1. **Canvas crop, no library** — The crop UI is implemented with positioned CSS + Canvas API. The `react-image-crop` and `cropperjs` libraries both work, but the project avoids component libraries. The crop logic (transform state → canvas extraction) is ~80 lines of vanilla code.

2. **Fixed R2 key (overwrite on re-upload)** — Using `cats/{cat_id}/photo.jpg` as the fixed key means there's only ever one object per cat. Simpler than versioned keys; no accumulation of stale objects.

3. **Proxy through Worker (not presigned PUT)** — The Worker receives the image and puts it to R2. Simpler than presigned URLs. At 400×400 JPEG ~80KB, the Worker body is well within limits and adds negligible CPU cost.

4. **JPEG output only** — Canvas `toBlob('image/jpeg', 0.85)` is used regardless of the input format. PNG/WebP/HEIC inputs are all normalized to JPEG on the client. Simplifies storage (always `.jpg`) and content-type validation on the server.

5. **Photo size: 400×400px** — Larger than the largest display size (80px) by 5×, giving retina screens crispness while keeping file sizes small (~50–90KB). Any larger provides no visible benefit.

6. **Optimistic UI** — The avatar updates immediately from the local `blob:` URL while the upload is in flight. On success, the permanent `photo_url` replaces the blob URL. On failure, revert and show an inline error.

7. **Household sharing** — Since cats belong to households, photo uploads are visible to all household members immediately. The `photo_url` is stored on the cat row, which all members can read.

---

## Implementation Plan

### Phase A — Core upload and display

1. **Infrastructure**: Create R2 bucket `cat-tracker-photos`; enable public access; note the `pub-xxxx.r2.dev` domain; add `[[r2_buckets]]` binding to `wrangler.toml`; add `PHOTOS: R2Bucket` to `AppEnv`.

2. **Worker route** (`worker/src/routes/cats.ts` or a new `worker/src/routes/photos.ts`):
   - `POST /api/cats/:id/photo`: parse multipart, validate, put to R2, update D1, return `{ photo_url }`
   - `DELETE /api/cats/:id/photo`: delete from R2, null out D1 field, return `{ ok: true }`

3. **API client** (`frontend/src/lib/api.ts`):
   - `uploadCatPhoto(catId: string, blob: Blob): Promise<{ photo_url: string }>`
   - `deleteCatPhoto(catId: string): Promise<void>`

4. **`CatAvatar` component** (`frontend/src/components/CatAvatar.tsx`):
   - Props: `photoUrl: string | null`, `name: string`, `size: number`, `className?: string`
   - Renders `<img>` with `object-fit: cover` if `photoUrl`, else 🐱 emoji div
   - Replace the hardcoded avatar divs in `Home.tsx` and `CatProfile.tsx`

5. **Photo upload UI in Add/Edit Cat form** (`AddEditCat.tsx`):
   - Add photo slot at top of form
   - File picker (`<input type="file" accept="image/*">`, hidden, triggered by button)
   - On file select: open crop modal
   - "Change photo" / "Remove" links when photo is set
   - Upload happens on form save (or immediately after crop confirm — prefer immediately to give fast feedback)

6. **Crop modal** (`frontend/src/components/CropModal.tsx`):
   - Full-screen overlay
   - Image rendered with CSS transform (translate + scale)
   - Circular aperture via `border-radius: 50%` on a fixed container + dark scrim on overflow
   - Touch events: `touchstart/move` for drag; `gesturechange` / two-finger distance for pinch-to-zoom
   - Mouse events: `mousemove` for drag; `wheel` for zoom
   - Zoom slider: `<input type="range">`
   - "Save" button: extract via Canvas, call `onCrop(blob: Blob)` callback
   - "Cancel" button: close without change

7. **Canvas extraction logic** (inside `CropModal.tsx`):
   ```
   // aperture is a fixed square at center of container (e.g. 280px)
   // image is displayed at: translate(offsetX, offsetY) scale(scale)
   // natural image size: naturalW × naturalH
   // displayed image size (at scale 1): containerW × containerH (object-contain proportions)
   //
   // crop rectangle in image natural coordinates:
   //   centerX = (apertureX - offsetX) / scale / displayScale
   //   centerY = (apertureY - offsetY) / scale / displayScale
   //   cropW = apertureSize / scale / displayScale
   //
   // Canvas: 400×400, drawImage(img, srcX, srcY, srcW, srcH, 0, 0, 400, 400)
   ```

8. **Cat Profile hero** (`CatProfile.tsx`):
   - Make the avatar tappable (Editor role check via `myRole` already available from household response)
   - On tap: show action sheet ("Change photo" / "Remove photo")
   - Inline "Change photo" flow (no navigating to the edit form)

9. **Vet Export** (`CatExportPage.tsx`):
   - Add photo to the print layout near the cat name/header if `photo_url` is set
   - Use `<img>` at 64px circular, natural rendering for print

10. **CSP update** (`worker/src/index.ts`):
    - Add the R2 public domain to `img-src` in the `Content-Security-Policy` header

### Phase B — Polish (post-launch)

1. Custom domain for photo URLs (`photos.01j.me`) so URLs look clean on the vet export
2. Loading skeleton for avatar while photo loads (`bg-surface animate-pulse`)
3. Error state if photo load fails (falls back to emoji automatically via `<img onError>`)
