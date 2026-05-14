export function audioBase64ToDataUrl(base64: string, mimeType = "audio/wav") {
  return `data:${mimeType};base64,${base64}`;
}
