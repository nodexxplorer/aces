import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

interface AdminPackMarkProps {
  size?: number;
}

/**
 * Neutral platform mark for the sign-in hero. It is the same drawing as the
 * web's AdminPackMark, so the two match. It carries no department branding:
 * the hero is shared by every department, so no department's logo appears there.
 */
export default function AdminPackMark({ size = 88 }: AdminPackMarkProps) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Admin Pack">
      <Svg width={size} height={size} viewBox="0 0 128 128">
        <Rect width="128" height="128" rx="28" fill="#1e293b" />
        <Rect x="26" y="30" width="76" height="16" rx="8" fill="#94a3b8" />
        <Rect x="26" y="56" width="76" height="16" rx="8" fill="#cbd5e1" />
        <Rect x="26" y="82" width="76" height="16" rx="8" fill="#f8fafc" />
      </Svg>
    </View>
  );
}
