import { type JakartoMultipassImage } from '../services/jakarto'

/**
 * Builds the list of date chips shown in the panorama timeline. Always at
 * least the current image (even without multipass), so the date stays
 * visible in every case — not just when several captures exist at the same
 * spot. Extracted from widget.tsx so it can be unit tested in isolation.
 */
export function buildTimelineEntries(
  availableImages: JakartoMultipassImage[],
  currentImageId: string | null,
  currentDate: string | null
): JakartoMultipassImage[] {
  if (availableImages.length > 0) return availableImages
  if (currentImageId != null) return [{ imageId: currentImageId, date: currentDate }]
  return []
}
