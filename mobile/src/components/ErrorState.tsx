import React from 'react';
import { EmptyState } from './EmptyState';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Something went wrong"
      description={message ?? 'Please try again.'}
      actionLabel={onRetry ? 'Retry' : undefined}
      onAction={onRetry}
    />
  );
}
