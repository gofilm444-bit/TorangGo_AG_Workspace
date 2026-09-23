import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { merchantApiClient } from '../api';
import type {
  MerchantOnboardingStatusResponseDto,
  MerchantOnboardingDraftDto,
  SaveMerchantOnboardingDraftDto,
  SubmitMerchantOnboardingDto,
  MerchantOnboardingDocumentDto,
} from '@platform/api-client';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface OnboardingContextValue {
  statusData: MerchantOnboardingStatusResponseDto | null;
  draft: MerchantOnboardingDraftDto | null;
  loading: boolean;
  error: string | null;
  autosaveStatus: AutosaveStatus;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  refreshStatus: () => Promise<void>;
  startOnboarding: () => Promise<void>;
  updateDraftField: (fields: Partial<SaveMerchantOnboardingDraftDto>) => void;
  saveDraftImmediate: (fields?: Partial<SaveMerchantOnboardingDraftDto>) => Promise<void>;
  uploadKtpFile: (file: unknown, filename?: string) => Promise<MerchantOnboardingDocumentDto>;
  submitOnboarding: (dto: SubmitMerchantOnboardingDto) => Promise<void>;
  repairOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function computeFirstIncompleteStep(draft: MerchantOnboardingDraftDto | null): number {
  if (!draft) return 1;

  // Step 1: Owner data
  const hasOwner = Boolean(
    draft.fullName &&
    draft.fullName.trim().length >= 2 &&
    draft.nik &&
    /^\d{16}$/.test(draft.nik.trim()),
  );
  if (!hasOwner) return 1;

  // Step 2: Proposed business data
  const hasBusiness = Boolean(
    draft.proposedBusinessName &&
    draft.proposedBusinessName.trim().length >= 2 &&
    draft.businessCategory &&
    draft.businessCategory.trim().length > 0,
  );
  if (!hasBusiness) return 2;

  // Step 3: Correspondence address data
  const hasAddress = Boolean(
    draft.province &&
    draft.province.trim().length >= 2 &&
    draft.regencyOrCity &&
    draft.regencyOrCity.trim().length >= 2 &&
    draft.district &&
    draft.district.trim().length >= 2 &&
    draft.villageOrSubdistrict &&
    draft.villageOrSubdistrict.trim().length >= 2 &&
    draft.addressDetail &&
    draft.addressDetail.trim().length >= 5,
  );
  if (!hasAddress) return 3;

  // Step 4: Identity document (KTP)
  const hasKtp = Boolean(draft.ktpDocumentId);
  if (!hasKtp) return 4;

  // Step 5: All previous steps complete -> ready for review
  return 5;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [statusData, setStatusData] = useState<MerchantOnboardingStatusResponseDto | null>(null);
  const [draft, setDraft] = useState<MerchantOnboardingDraftDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [currentStep, setCurrentStep] = useState(1);

  const pendingChangesRef = useRef<Partial<SaveMerchantOnboardingDraftDto>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSequenceRef = useRef(0);
  const hasInitializedStepRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await merchantApiClient.getMerchantOnboardingStatus();
      setStatusData(res);
      if (res.draft) {
        setDraft(res.draft);
        if (!hasInitializedStepRef.current) {
          hasInitializedStepRef.current = true;
          setCurrentStep(computeFirstIncompleteStep(res.draft));
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat status pendaftaran mitra';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startOnboarding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await merchantApiClient.getOrCreateMerchantOnboardingDraft();
      setDraft(res);
      hasInitializedStepRef.current = true;
      setCurrentStep(1);
      await fetchStatus();
      setCurrentStep(1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memulai draft pendaftaran';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  const persistDraft = useCallback(
    async (fields: Partial<SaveMerchantOnboardingDraftDto>) => {
      if (Object.keys(fields).length === 0) return;
      const seq = ++saveSequenceRef.current;
      setAutosaveStatus('saving');
      try {
        const updated = await merchantApiClient.saveMerchantOnboardingDraft(fields);
        setDraft(updated);
        setAutosaveStatus('saved');
        if (seq === saveSequenceRef.current) {
          setDraft(updated);
          setAutosaveStatus('saved');
        }
      } catch (err: unknown) {
        setAutosaveStatus('error');
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan perubahan draft';
        setError(msg);
        if (seq === saveSequenceRef.current) {
          setAutosaveStatus('error');
          const msg = err instanceof Error ? err.message : 'Gagal menyimpan perubahan draft';
          setError(msg);
        }
      }
    },
    [],
  );

  const updateDraftField = useCallback(
    (fields: Partial<SaveMerchantOnboardingDraftDto>) => {
      // Optimistically merge in local state
      setDraft((prev: MerchantOnboardingDraftDto | null) =>
        prev ? { ...prev, ...fields } : (fields as unknown as MerchantOnboardingDraftDto),
      );
      pendingChangesRef.current = { ...pendingChangesRef.current, ...fields };

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const payload = { ...pendingChangesRef.current };
        pendingChangesRef.current = {};
        persistDraft(payload);
      }, 600);
    },
    [persistDraft],
  );

  const saveDraftImmediate = useCallback(
    async (fields?: Partial<SaveMerchantOnboardingDraftDto>) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const merged = { ...pendingChangesRef.current, ...(fields ?? {}) };
      pendingChangesRef.current = {};
      await persistDraft(merged);
    },
    [persistDraft],
  );

  const uploadKtpFile = useCallback(
    async (file: unknown, filename = 'ktp.jpg') => {
      setLoading(true);
      setError(null);
      try {
        const doc = await merchantApiClient.uploadMerchantKtp(file, filename);
        setDraft((prev: MerchantOnboardingDraftDto | null) =>
          prev ? { ...prev, ktpDocumentId: doc.id, ktpDocument: doc } : null,
        );
        return doc;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal mengunggah foto KTP';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const submitOnboarding = useCallback(
    async (dto: SubmitMerchantOnboardingDto) => {
      setLoading(true);
      setError(null);
      try {
        // Ensure any pending autosave changes are persisted first
        await saveDraftImmediate();
        const res = await merchantApiClient.submitMerchantOnboarding(dto);
        setStatusData(res);
        setDraft(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Gagal mengirimkan formulir pendaftaran';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [saveDraftImmediate],
  );

  const repairOnboarding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const repaired = await merchantApiClient.repairMerchantOnboarding();
      setDraft(repaired);
      await fetchStatus();
      setCurrentStep(1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuka kembali draft perbaikan';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  return (
    <OnboardingContext.Provider
      value={{
        statusData,
        draft,
        loading,
        error,
        autosaveStatus,
        currentStep,
        setCurrentStep,
        refreshStatus: fetchStatus,
        startOnboarding,
        updateDraftField,
        saveDraftImmediate,
        uploadKtpFile,
        submitOnboarding,
        repairOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
