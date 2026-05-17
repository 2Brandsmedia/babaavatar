import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '@renderer/store/settings';
import { useAvatarsStore } from '@renderer/store/avatars';
import { useTrackingStore } from '@renderer/store/tracking';
import {
  createAvatarChannel,
  createAvatarRequestChannel,
  type ActiveAvatarMessage,
} from '@renderer/lib/broadcast/avatar-channel';
import { createReloadChannel } from '@renderer/lib/broadcast/reload-channel';
import type { AvatarRecord } from '@shared/types';
import { ControlLayout } from '@renderer/components/ControlLayout';
import { Sidebar, type SidebarSection } from '@renderer/components/Sidebar';
import { StatusBar } from '@renderer/components/StatusBar';
import { CreditsModal } from '@renderer/components/CreditsModal';
import { GlobalTrackingHost } from '@renderer/components/GlobalTrackingHost';
import { UpdaterOverlay } from '@renderer/components/updater/UpdaterOverlay';
import { AvatarsSection } from '@renderer/components/avatars/AvatarsSection';
import { TrackingPanel } from '@renderer/components/TrackingPanel';
import { CalibrationWizard } from '@renderer/components/calibration/CalibrationWizard';
import { HotkeyManager } from '@renderer/components/hotkeys/HotkeyManager';
import { SettingsPanel } from '@renderer/components/settings/SettingsPanel';

function buildAssetUrl(id: string): string {
  return `babaavatar-asset://avatar/${id}`;
}

export function App(): JSX.Element {
  const { settings, load: loadSettings, update } = useSettingsStore();
  const { avatars, load: loadAvatars } = useAvatarsStore();
  const reloadCounter = useTrackingStore((state) => state.reloadCounter);
  const triggerReload = useTrackingStore((state) => state.triggerReload);
  const [section, setSection] = useState<SidebarSection>('avatars');
  const [showCredits, setShowCredits] = useState(false);

  useEffect(() => {
    void loadSettings();
    void loadAvatars();
  }, [loadSettings, loadAvatars]);

  useEffect(() => {
    const channel = createReloadChannel();
    const unsubscribe = channel.subscribe(() => triggerReload());
    return () => {
      unsubscribe();
      channel.close();
    };
  }, [triggerReload]);

  const activeAvatar: AvatarRecord | null = useMemo(() => {
    if (!settings?.activeAvatarId) return null;
    const lookup = new Map(avatars.map((a) => [a.id, a]));
    return lookup.get(settings.activeAvatarId) ?? null;
  }, [settings?.activeAvatarId, avatars]);

  const avatarChannelRef = useRef<ReturnType<typeof createAvatarChannel> | null>(null);
  if (avatarChannelRef.current === null) avatarChannelRef.current = createAvatarChannel();
  const lastAvatarMessageRef = useRef<ActiveAvatarMessage>({
    avatar: null,
    fileUrl: null,
    reloadCounter: 0,
  });

  useEffect(() => {
    const message: ActiveAvatarMessage = {
      avatar: activeAvatar,
      fileUrl: activeAvatar ? buildAssetUrl(activeAvatar.id) : null,
      reloadCounter,
    };
    lastAvatarMessageRef.current = message;
    avatarChannelRef.current?.publish(message);
  }, [activeAvatar, reloadCounter]);

  useEffect(() => {
    const request = createAvatarRequestChannel();
    const unsubscribe = request.onRequest(() => {
      avatarChannelRef.current?.publish(lastAvatarMessageRef.current);
    });
    return () => {
      unsubscribe();
      request.close();
    };
  }, []);

  useEffect(() => {
    return () => {
      avatarChannelRef.current?.close();
      avatarChannelRef.current = null;
    };
  }, []);

  const handleSelectAvatar = useCallback(
    (id: string) => {
      void update('activeAvatarId', id);
    },
    [update],
  );

  return (
    <>
      <GlobalTrackingHost />
      <ControlLayout
        sidebar={
          <Sidebar
            active={section}
            onSelect={setSection}
            onShowCredits={() => setShowCredits(true)}
            avatarCount={avatars.length}
          />
        }
        statusBar={<StatusBar activeAvatar={activeAvatar} />}
      >
        <SectionRouter
          section={section}
          activeAvatarId={settings?.activeAvatarId ?? null}
          avatarCount={avatars.length}
          onSelectAvatar={handleSelectAvatar}
        />
        {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
      </ControlLayout>
      <UpdaterOverlay />
    </>
  );
}

interface SectionRouterProps {
  section: SidebarSection;
  activeAvatarId: string | null;
  avatarCount: number;
  onSelectAvatar: (id: string) => void;
}

function SectionRouter({
  section,
  activeAvatarId,
  avatarCount,
  onSelectAvatar,
}: SectionRouterProps): JSX.Element {
  switch (section) {
    case 'avatars':
      return (
        <AvatarsSection
          activeAvatarId={activeAvatarId}
          onSelect={onSelectAvatar}
          avatarCount={avatarCount}
        />
      );
    case 'tracking':
      return <TrackingPanel />;
    case 'calibration':
      return <CalibrationWizard activeAvatarId={activeAvatarId} />;
    case 'hotkeys':
      return <HotkeyManager />;
    case 'settings':
      return <SettingsPanel />;
    default:
      return <div>Unbekannter Bereich.</div>;
  }
}
