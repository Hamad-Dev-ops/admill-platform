import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ErrorState, Header, LoadingState } from '../../../components';
import { getMyCompany, getMyCompanySettings } from '../../../api/companies.api';
import { colors, spacing } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';
import { CompanyProfileCard } from './CompanyProfileCard';
import { OperatingSettingsCard } from './OperatingSettingsCard';
import { PricingCard } from './PricingCard';

type Props = NativeStackScreenProps<OwnerStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const companyQuery = useQuery({ queryKey: ['companies', 'me'], queryFn: getMyCompany });
  const settingsQuery = useQuery({
    queryKey: ['companies', 'me', 'settings'],
    queryFn: getMyCompanySettings,
  });

  const isLoading = companyQuery.isLoading || settingsQuery.isLoading;
  const isError = companyQuery.isError || settingsQuery.isError || !companyQuery.data;

  return (
    <View style={styles.container}>
      <Header title="Company Settings" onBack={() => navigation.goBack()} />

      {isLoading && <LoadingState />}
      {!isLoading && isError && (
        <ErrorState
          onRetry={() => {
            companyQuery.refetch();
            settingsQuery.refetch();
          }}
        />
      )}
      {!isLoading && !isError && companyQuery.data && (
        <ScrollView contentContainerStyle={styles.content}>
          <CompanyProfileCard company={companyQuery.data} />
          {settingsQuery.data && <OperatingSettingsCard settings={settingsQuery.data} />}
          <PricingCard />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
});
