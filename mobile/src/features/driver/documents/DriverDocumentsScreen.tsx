import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ErrorState, Header, InlineError, LoadingState, StatusChip } from '../../../components';
import { getApiErrorMessage } from '../../../api/client';
import { getMyDriverProfile } from '../../../api/drivers.api';
import { listDriverDocuments, uploadDriverDocument } from '../../../api/documents.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { DocumentType } from '../../../types/enums';
import { DOCUMENT_STATUS_LABEL, DOCUMENT_STATUS_TONE } from '../../../utils/statusPresentation';
import { DOCUMENT_TYPE_LABEL, DRIVER_DOCUMENT_TYPES } from './documentLabels';

// Driver-facing only — no verify/reject controls (PATCH /documents/:id/verify
// is OWNER-only, verified against document.routes.ts). A driver can only see
// their own status and re-upload.
export function DriverDocumentsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);

  const driverQuery = useQuery({
    queryKey: ['drivers', 'me'],
    queryFn: getMyDriverProfile,
  });
  const driverId = driverQuery.data?._id;

  const documentsQuery = useQuery({
    queryKey: ['drivers', driverId, 'documents'],
    queryFn: () => listDriverDocuments(driverId!),
    enabled: !!driverId,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ documentType, asset }: { documentType: DocumentType; asset: { uri: string; name: string; type: string } }) =>
      uploadDriverDocument(driverId!, documentType, asset),
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ['drivers', driverId, 'documents'] });
    },
    onError: (error) => setUploadError(getApiErrorMessage(error, 'Unable to upload document')),
    onSettled: () => setUploadingType(null),
  });

  async function pickAndUpload(documentType: DocumentType) {
    setUploadError(null);
    // Performance Audit finding F6 — previously uploaded at full camera/
    // library resolution (only JPEG re-encode quality was capped). A
    // document photo just needs to be legible, not print-resolution;
    // capping the long edge cuts upload size/time substantially on a weak
    // connection with no visible legibility loss. Quality/file-type/error
    // handling are all unchanged.
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1600, maxHeight: 1600 });
    if (result.didCancel || result.errorCode) {
      if (result.errorCode) setUploadError(result.errorMessage ?? 'Unable to open the photo library');
      return;
    }
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setUploadingType(documentType);
    uploadMutation.mutate({
      documentType,
      asset: {
        uri: asset.uri,
        name: asset.fileName ?? `${documentType.toLowerCase()}.jpg`,
        type: asset.type ?? 'image/jpeg',
      },
    });
  }

  const isLoading = driverQuery.isLoading || (!!driverId && documentsQuery.isLoading);
  const isError = driverQuery.isError || !driverQuery.data || documentsQuery.isError;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="Documents" onBack={() => navigation.goBack()} />

      {isLoading && <LoadingState />}
      {!isLoading && isError && (
        <ErrorState
          onRetry={() => {
            driverQuery.refetch();
            documentsQuery.refetch();
          }}
        />
      )}

      {!isLoading && !isError && (
        <ScrollView contentContainerStyle={styles.content}>
          {!!uploadError && <InlineError>{uploadError}</InlineError>}

          {DRIVER_DOCUMENT_TYPES.map((type) => {
            const existing = documentsQuery.data
              ?.filter((doc) => doc.documentType === type)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            const isUploadingThis = uploadingType === type && uploadMutation.isPending;

            return (
              <Card key={type}>
                <Card.Content style={styles.cardContent}>
                  <View style={styles.row}>
                    <Text variant="titleSmall">{DOCUMENT_TYPE_LABEL[type]}</Text>
                    {existing && (
                      <StatusChip
                        label={DOCUMENT_STATUS_LABEL[existing.verificationStatus]}
                        tone={DOCUMENT_STATUS_TONE[existing.verificationStatus]}
                      />
                    )}
                  </View>
                  {!existing && (
                    <Text variant="bodySmall" style={styles.muted}>
                      Not uploaded yet.
                    </Text>
                  )}
                  {existing?.verificationStatus === 'REJECTED' && existing.rejectionReason && (
                    <Text variant="bodySmall" style={styles.rejectedReason}>
                      Reason: {existing.rejectionReason}
                    </Text>
                  )}
                  <Button
                    variant="secondary"
                    onPress={() => pickAndUpload(type)}
                    loading={isUploadingThis}
                    disabled={uploadMutation.isPending}
                  >
                    {existing ? 'Re-upload' : 'Upload'}
                  </Button>
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  cardContent: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.inkMuted },
  rejectedReason: { color: colors.danger },
  error: { color: colors.danger },
});
