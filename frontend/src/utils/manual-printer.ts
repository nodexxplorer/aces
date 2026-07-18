export const addToPrintQueue = async (manualId: string, userId: string): Promise<string> => {
  return `PRINT-${manualId}-${userId}-${Date.now()}`;
};

export const processPrintJob = async (_queueId: string): Promise<boolean> => {
  return true;
};
