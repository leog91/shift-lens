import { isAbsolute, relative } from "node:path";

export const photoInboxRoot = "photo-inbox";
export const manualReviewPhotoRoot = `${photoInboxRoot}/manual-review`;
export const organizedPhotoRoot = `${photoInboxRoot}/organized`;

export function isPhotoInboxPath(path: string) {
  return path.startsWith(`${photoInboxRoot}/`);
}

// A plain startsWith check also accepts a sibling such as photo-inbox-archive,
// so compare the resolved paths on a directory boundary instead.
export function isInsideDirectory(directory: string, candidate: string) {
  const path = relative(directory, candidate);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}
