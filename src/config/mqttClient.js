import mqtt from 'mqtt';

const EMQX_WS_URL = import.meta.env.VITE_MQTT_WS_URL || 'ws://localhost:8083/mqtt';

export function createMqttSubscription(onEvent, onStatusChange) {
  const clientId = 'digiwms_web_' + Math.random().toString(16).substring(2, 8);
  const client = mqtt.connect(EMQX_WS_URL, {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    if (onStatusChange) onStatusChange(true);
    client.subscribe(['digiwms/#', 'wms/#'], { qos: 0 });
  });

  client.on('reconnect', () => {
    if (onStatusChange) onStatusChange(false);
  });

  client.on('close', () => {
    if (onStatusChange) onStatusChange(false);
  });

  client.on('message', (topic, payloadBuffer) => {
    try {
      const payload = JSON.parse(payloadBuffer.toString());
      if (onEvent) {
        onEvent({
          topic,
          payload,
          receivedAt: new Date().toLocaleTimeString('id-ID'),
        });
      }
    } catch {
      // Ignore malformed JSON
    }
  });

  return {
    disconnect: () => client.end(true),
  };
}
