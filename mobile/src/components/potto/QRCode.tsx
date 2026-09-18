import QRCodeSvg from 'react-native-qrcode-svg';

import { usePottoColors } from '@/constants/potto-theme';

export function QRCode({ value, size = 180 }: { value: string; size?: number }) {
  const colors = usePottoColors();
  return <QRCodeSvg value={value} size={size} color={colors.ink} backgroundColor={colors.surface} />;
}
