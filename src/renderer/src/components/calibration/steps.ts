export const STEPS = [
  { id: 'welcome', title: 'Willkommen' },
  { id: 'camera', title: 'Kamera' },
  { id: 'microphone', title: 'Mikrofon' },
  { id: 'avatar', title: 'Avatar' },
  { id: 'neutral', title: 'Neutrale Pose' },
  { id: 'mouth', title: 'Mund' },
  { id: 'eyes', title: 'Augen' },
  { id: 'brows', title: 'Augenbrauen' },
  { id: 'smile', title: 'Lächeln' },
  { id: 'hands', title: 'Hände' },
  { id: 'done', title: 'Fertig' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];
