/**
 * Phase 2B Merchant Onboarding Types and Constants.
 */

export const MERCHANT_TERMS_VERSION = '1.0';
export const PRIVACY_NOTICE_VERSION = '1.0';

export const MERCHANT_ONBOARDING_GATE_STATES = [
  'NOT_STARTED',
  'DRAFT',
  'PENDING',
  'REJECTED',
  'APPROVED',
  'SUSPENDED',
] as const;

export type MerchantOnboardingGateState =
  (typeof MERCHANT_ONBOARDING_GATE_STATES)[number];

export const MERCHANT_SUBMISSION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
] as const;

export type MerchantSubmissionStatus =
  (typeof MERCHANT_SUBMISSION_STATUSES)[number];

export const MERCHANT_DOCUMENT_TYPES = ['KTP_FRONT'] as const;
export type MerchantDocumentType = (typeof MERCHANT_DOCUMENT_TYPES)[number];
