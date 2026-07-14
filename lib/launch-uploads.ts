import { addDoc, collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";
import type { LaunchUpload, LaunchUploadKind } from "./types";

// Premium assisted data import: the owner uploads a file, LittleLoop
// reviews and imports it by hand — no automated CSV/spreadsheet parsing
// pipeline exists yet (see LittleLoop-Onboarding-Redesign-Spec and Phase 3
// scope notes). Storage path/rules: storage.rules
// schools/{schoolId}/launch-uploads/{fileName}. Firestore rules:
// firestore.rules launchUploads/{uploadId} — owners can only create
// (status always starts "submitted"); only staff can update/delete.

const ALL_UPLOAD_KINDS: LaunchUploadKind[] = ["children", "teachers", "parents", "feeStructure"];

export async function uploadLaunchFile(schoolId: string, kind: LaunchUploadKind, file: File): Promise<string> {
  const path = `schools/${schoolId}/launch-uploads/${kind}-${Date.now()}-${file.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

export async function createLaunchUpload(
  schoolId: string,
  kind: LaunchUploadKind,
  fileName: string,
  fileUrl: string,
  submittedBy: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, "launchUploads"), {
    schoolId,
    kind,
    fileName,
    fileUrl,
    status: "submitted",
    submittedAt: new Date().toISOString(),
    submittedBy,
  });
  return docRef.id;
}

/**
 * Latest submission per kind (each "replace file" is a new doc, not an
 * update — see module comment). Four small indexed queries rather than one
 * broad query + client-side grouping, since there are only ever four kinds.
 */
export async function getLatestLaunchUploads(schoolId: string): Promise<Partial<Record<LaunchUploadKind, LaunchUpload>>> {
  const results = await Promise.all(ALL_UPLOAD_KINDS.map(async (kind): Promise<LaunchUpload | null> => {
    const q = query(
      collection(db, "launchUploads"),
      where("schoolId", "==", schoolId),
      where("kind", "==", kind),
      orderBy("submittedAt", "desc"),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as LaunchUpload;
  }));

  const map: Partial<Record<LaunchUploadKind, LaunchUpload>> = {};
  ALL_UPLOAD_KINDS.forEach((kind, i) => {
    const upload = results[i];
    if (upload) map[kind] = upload;
  });
  return map;
}
