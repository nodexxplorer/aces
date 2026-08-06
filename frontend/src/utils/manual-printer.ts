export const addToPrintQueue = async (manualId: string, userId: string): Promise<string> => {
  return `PRINT-${manualId}-${userId}-${Date.now()}`;
};

export const processPrintJob = async (queueId: string): Promise<boolean> => {
  // Stub: no real print-queue backend wired up yet, so there's nothing to do
  // with the id besides acknowledge it — keeping the parameter (rather than
  // dropping it) preserves the real signature this will need once a backend
  // job exists to look up.
  void queueId;
  return true;
};
