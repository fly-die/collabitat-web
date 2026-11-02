// Stands in for the browser's WebSocket in tests: records what the app sends and lets a test
// play the server's side.
export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  readonly sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  static latest() {
    return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  serverOpens() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  serverSends(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverCloses(code = 1006) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code });
  }
}
