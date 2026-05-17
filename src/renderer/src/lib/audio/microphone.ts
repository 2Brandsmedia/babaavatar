export interface MicrophoneStream {
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  stop: () => void;
}

export async function startMicrophone(deviceId: string | null): Promise<MicrophoneStream> {
  const constraints: MediaStreamConstraints = {
    audio: deviceId
      ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true },
    video: false,
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const audioContext = new AudioContext({ sampleRate: 48000 });
  const sourceNode = audioContext.createMediaStreamSource(stream);

  return {
    audioContext,
    sourceNode,
    stop: () => {
      stream.getTracks().forEach((track) => track.stop());
      void audioContext.close();
    },
  };
}
