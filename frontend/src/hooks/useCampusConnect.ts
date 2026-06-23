import { useCampusConnectStore } from '../stores/campusConnectStore';

export const useCampusConnect = () => {
  const store = useCampusConnectStore();
  return { ...store };
};
