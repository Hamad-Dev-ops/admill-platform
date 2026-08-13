// socket.io-client has no manual mock in __mocks__/ yet — this is the first
// test file that needs to control it, so the fake is defined inline here.
// The fake mirrors just enough of the real Socket shape (a mutable `auth`
// property, `connected`, and connect/disconnect/on/off/emit as jest.fn()s)
// to prove SocketService's connect() reuses one instance across a session
// instead of silently orphaning listeners on every reconnect.
const fakeSockets: Array<{
  auth: unknown;
  connected: boolean;
  connect: jest.Mock;
  disconnect: jest.Mock;
  on: jest.Mock;
  off: jest.Mock;
  emit: jest.Mock;
}> = [];

const mockIo = jest.fn((_url: string, options: { auth: unknown }) => {
  const socket = {
    auth: options.auth,
    connected: false,
    connect: jest.fn(function (this: (typeof fakeSockets)[number]) {
      this.connected = true;
    }),
    disconnect: jest.fn(function (this: (typeof fakeSockets)[number]) {
      this.connected = false;
    }),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  };
  fakeSockets.push(socket);
  return socket;
});

jest.mock('socket.io-client', () => ({
  io: (...args: [string, { auth: unknown }]) => mockIo(...args),
}));

jest.mock('../../src/config/env', () => ({ env: { SOCKET_URL: 'http://test.local' } }));

import { SocketService } from '../../src/socket/SocketService';

describe('SocketService', () => {
  beforeEach(() => {
    fakeSockets.length = 0;
    mockIo.mockClear();
    SocketService.disconnect(); // reset the singleton's internal socket to null between tests
  });

  it('creates exactly one io() instance across repeated connect() calls in the same session', () => {
    SocketService.connect('token-1');
    SocketService.connect('token-2');
    SocketService.reconnect('token-3');

    expect(mockIo).toHaveBeenCalledTimes(1);
  });

  it('updates auth and reconnects the same socket instead of replacing it, so existing listeners survive', () => {
    SocketService.connect('token-1');
    const handler = jest.fn();
    SocketService.on('job:new-request', handler);
    const [socket] = fakeSockets;

    SocketService.reconnect('token-2');

    expect(fakeSockets).toHaveLength(1); // no second instance was ever created
    expect(socket.auth).toEqual({ token: 'token-2' });
    expect(socket.connect).toHaveBeenCalled();
    // The listener registered before reconnecting is still on the same
    // object — nothing needed to re-subscribe it.
    expect(socket.on).toHaveBeenCalledWith('job:new-request', handler);
  });

  it('disconnects the existing socket before reconnecting if it was still connected', () => {
    SocketService.connect('token-1');
    const [socket] = fakeSockets;
    socket.connected = true;

    SocketService.reconnect('token-2');

    expect(socket.disconnect).toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalled();
  });

  it('starts a fresh instance after an explicit disconnect() (logout), rather than reusing the old one', () => {
    SocketService.connect('token-1');
    SocketService.disconnect();
    SocketService.connect('token-2');

    expect(mockIo).toHaveBeenCalledTimes(2);
  });
});
