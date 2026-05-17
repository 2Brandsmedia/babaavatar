import { useEffect, useState } from 'react';
import type { AppSettings, AvatarRecord } from '@shared/types';
import { api } from '@renderer/lib/ipc/api';
import {
  createAvatarChannel,
  createAvatarRequestChannel,
} from '@renderer/lib/broadcast/avatar-channel';
import { AvatarStage } from './AvatarStage';
import { OutputTitleBar } from './OutputTitleBar';

export function OutputApp(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeAvatar, setActiveAvatar] = useState<AvatarRecord | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.settings.getAll().then(setSettings).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
    const channel = createAvatarChannel();
    const unsubscribe = channel.subscribe((msg) => {
      setActiveAvatar(msg.avatar);
      setActiveUrl(msg.fileUrl);
      setReloadKey(msg.reloadCounter);
    });

    const requestChannel = createAvatarRequestChannel();
    requestChannel.sendRequest();
    const retry = window.setInterval(() => requestChannel.sendRequest(), 1500);
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 6000);

    return () => {
      unsubscribe();
      channel.close();
      requestChannel.close();
      window.clearInterval(retry);
      window.clearTimeout(stopRetry);
    };
  }, []);

  if (!settings) {
    return (
      <Frame background="#00B140">
        <PlaceholderMessage text={error ?? 'Lade Output…'} background="#00B140" />
      </Frame>
    );
  }

  if (!activeUrl || !activeAvatar) {
    return (
      <Frame background={settings.chromaColor}>
        <PlaceholderMessage
          text="Avatar erscheint nach Auswahl hier."
          background={settings.chromaColor}
        />
      </Frame>
    );
  }

  return (
    <Frame background={settings.chromaColor}>
      <AvatarStage
        key={`${activeAvatar.id}-${reloadKey}`}
        background={settings.chromaColor}
        vrmUrl={activeUrl}
        mirror={settings.mirrorMode}
        onError={(err) => setError(err.message)}
      />
    </Frame>
  );
}

interface FrameProps {
  background: string;
  children: React.ReactNode;
}

function Frame({ background, children }: FrameProps): JSX.Element {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background }}>
      <OutputTitleBar />
      {children}
    </div>
  );
}

interface PlaceholderMessageProps {
  text: string;
  background: string;
}

function PlaceholderMessage({ text, background }: PlaceholderMessageProps): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#003315',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', opacity: 0.6 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>BabaAvatar Output</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>{text}</div>
      </div>
    </div>
  );
}
