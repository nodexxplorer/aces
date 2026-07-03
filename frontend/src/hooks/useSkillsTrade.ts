import { useSkillsTradeStore } from '../stores/skillsTradeStore';

export const useSkillsTrade = () => {
  const store = useSkillsTradeStore();
  return { ...store };
};
