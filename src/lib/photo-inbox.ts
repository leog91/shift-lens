export const photoInboxRoot = "photo-inbox";
export const manualReviewPhotoRoot = `${photoInboxRoot}/manual-review`;
export const organizedPhotoRoot = `${photoInboxRoot}/organized`;

export function isPhotoInboxPath(path: string) {
  return path.startsWith(`${photoInboxRoot}/`);
}
