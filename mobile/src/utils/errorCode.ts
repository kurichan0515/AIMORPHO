// UNIX秒下位12bit(68分サイクル) + 12bitランダム → 6文字16進エラーコード。
// サポート問い合わせ時にユーザーが参照しやすい短いコード。
export function generateErrorCode(): string {
  const timePart = (Math.floor(Date.now() / 1000) & 0xfff).toString(16).toUpperCase().padStart(3, '0');
  const randPart = Math.floor(Math.random() * 0x1000).toString(16).toUpperCase().padStart(3, '0');
  return `E-${timePart}${randPart}`;
}
