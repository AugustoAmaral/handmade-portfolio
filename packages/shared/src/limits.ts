/**
 * The numbers the API enforces and the panel has to draw, in the one place both can read.
 *
 * ALL FOUR WERE COPIES IN `apps/web/src/ui/admin`, and they were not equally dangerous. Two were
 * CHECKED — a story parsed the boundary through `productInputSchema`, so moving the schema's limit
 * without moving the copy reddened something. Two could not be: `MAX_PHOTO_BYTES` duplicated
 * multer's `limits.fileSize` and `MAX_TRACKING_CODE` the tracking field's `.max()`, both of which
 * live in Express routes no web test can import, so those two could drift in silence until somebody
 * met the wrong error on a real upload. Reading them from here is what makes the value one value
 * rather than two that agree today.
 *
 * They live in their own module rather than in `schemas.ts` because half of them are not schema
 * facts: a request-body size limit belongs to the transport, and `schemas.ts` importing from here
 * keeps the direction one-way.
 */

/** R$ 1,00. The floor `productInputSchema` puts under `priceCents`. */
export const MIN_PRICE_CENTS = 100

/** How many ficha-técnica rows a product may carry. `productInputSchema` caps the array here. */
export const MAX_SPECS = 12

/**
 * 8 MB. THE LIMIT IS EXCLUSIVE: a photo is accepted while it is STRICTLY SMALLER than this.
 *
 * ⚠️ Measured, and it is not what either side assumed. multer is configured `limits: { fileSize:
 * MAX_PHOTO_BYTES }` and busboy refuses a file of EXACTLY that many bytes — 8388607 is accepted,
 * 8388608 is not. The panel's own check was `size > MAX_PHOTO_BYTES`, so there was exactly one file
 * size the browser passed and the server threw away, and the failure it produced was the 500 below.
 * Both sides now agree on `< MAX_PHOTO_BYTES`, and `admin-products.test.ts` pins the boundary in
 * both directions rather than only from above.
 *
 * A file that reaches this is a 413 `PHOTO_TOO_LARGE`, whose message names this number: `multer`
 * throws a `MulterError`, and `errorHandler` maps `LIMIT_FILE_SIZE` to that code. It answered
 * `500 INTERNAL` until the upload's failures were given honest codes.
 *
 * ⚠️ THE PANEL STILL NEVER SEES THAT 413, and the value has to live here for that reason rather
 * than in spite of it. The browser refuses a file at `>= MAX_PHOTO_BYTES` while multer only errors
 * ABOVE it, so the window of sizes that pass one and trip the other is EMPTY. The 413 is the truth
 * for anything speaking to the API directly; the shared constant is what keeps that window shut.
 * The two guards drifting apart is the only thing that would open it.
 */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024

/** Longest tracking code the shipment PATCH accepts, and the panel's `maxLength`. */
export const MAX_TRACKING_CODE = 60
