import { apiClient } from './client';
import type { ApiSuccess } from '../types/api';
import type { DocumentType } from '../types/enums';
import type { AppDocument } from '../types/entities';

// frontend-docs/API-CONTRACT.md §Document. There is no /drivers/me/documents
// shortcut (verified against driver.routes.ts) — callers must resolve their
// own driver _id via getMyDriverProfile() first, then pass it here. Upload
// is multipart (field name "file", verified against upload.middleware.ts —
// image/jpeg, image/png, image/webp, application/pdf, 5MB max); there is no
// expiryDate field accepted on upload despite it existing on the model.

export async function listDriverDocuments(driverId: string): Promise<AppDocument[]> {
  const { data } = await apiClient.get<ApiSuccess<AppDocument[]>>(`/drivers/${driverId}/documents`);
  return data.data;
}

export interface UploadDriverDocumentAsset {
  uri: string;
  name: string;
  type: string;
}

export async function uploadDriverDocument(
  driverId: string,
  documentType: DocumentType,
  asset: UploadDriverDocumentAsset,
): Promise<AppDocument> {
  const form = new FormData();
  form.append('documentType', documentType);
  // React Native's FormData accepts this {uri,name,type} shape directly —
  // it is not a real web File/Blob, but RN's XHR polyfill knows how to send
  // it as a multipart file part.
  form.append('file', {
    uri: asset.uri,
    name: asset.name,
    type: asset.type,
  } as unknown as Blob);

  const { data } = await apiClient.post<ApiSuccess<AppDocument>>(
    `/drivers/${driverId}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}
