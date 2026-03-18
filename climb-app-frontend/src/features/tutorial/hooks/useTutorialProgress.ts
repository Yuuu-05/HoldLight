import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { getUserPreferencesApi, updateUserPreferencesApi } from '../../../shared/api/users.api';
import { getNextTutorialModule, tutorialModules } from '../../../shared/constants/tutorial';
import { readStorage, storageKeys, writeStorage } from '../../../shared/lib/storage';

const TUTORIAL_PROGRESS_EVENT = 'climbapp:tutorial-progress';

function readLocalProgress() {
  return readStorage<string[]>(storageKeys.tutorialProgress, []);
}

function writeLocalProgress(next: string[]) {
  writeStorage(storageKeys.tutorialProgress, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<string[]>(TUTORIAL_PROGRESS_EVENT, { detail: next }));
  }
}

export function useTutorialProgress() {
  const { isAuthenticated, isUsingDevAuth, loading } = useAuth();
  const [completedIds, setCompletedIds] = useState<string[]>(readLocalProgress);

  useEffect(() => {
    const handleExternalUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<string[]>;
      setCompletedIds(customEvent.detail ?? []);
    };

    window.addEventListener(TUTORIAL_PROGRESS_EVENT, handleExternalUpdate as EventListener);
    return () => {
      window.removeEventListener(TUTORIAL_PROGRESS_EVENT, handleExternalUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || isUsingDevAuth) {
      setCompletedIds(readLocalProgress());
      return;
    }

    let active = true;
    getUserPreferencesApi()
      .then((preferences) => {
        if (!active) return;
        const next = preferences.tutorialProgress.completedIds ?? [];
        setCompletedIds(next);
        writeLocalProgress(next);
      })
      .catch(() => {
        if (active) {
          setCompletedIds(readLocalProgress());
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, isUsingDevAuth, loading]);

  const syncCompletedIds = useCallback(
    (next: string[]) => {
      writeLocalProgress(next);
      setCompletedIds(next);
      if (isAuthenticated && !isUsingDevAuth) {
        void updateUserPreferencesApi({
          tutorialProgress: {
            completedIds: next,
          },
        });
      }
    },
    [isAuthenticated, isUsingDevAuth],
  );

  const markCompleted = useCallback(
    (moduleId: string) => {
      if (completedIds.includes(moduleId)) {
        return;
      }

      syncCompletedIds([...completedIds, moduleId]);
    },
    [completedIds, syncCompletedIds],
  );

  const resetProgress = useCallback(() => {
    syncCompletedIds([]);
  }, [syncCompletedIds]);

  const progress = useMemo(() => {
    const nextModule = getNextTutorialModule(completedIds);
    const completionRate = tutorialModules.length
      ? Math.round((completedIds.length / tutorialModules.length) * 100)
      : 0;

    return {
      completedIds,
      completedCount: completedIds.length,
      remainingCount: tutorialModules.length - completedIds.length,
      nextModule,
      completionRate,
      isComplete: completedIds.length >= tutorialModules.length,
    };
  }, [completedIds]);

  return {
    ...progress,
    markCompleted,
    resetProgress,
  };
}
