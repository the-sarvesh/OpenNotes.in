import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (socketInstance && socketInstance.connected) return socketInstance;

  // Disconnect stale instance if it exists
  if (socketInstance) {
    socketInstance.disconnect();
  }

  const SOCKET_URL =
    import.meta.env.VITE_BACKEND_URL ||
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:5000`
      : "http://localhost:5000");

  socketInstance = io(SOCKET_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnectionAttempts: 5,
    reconnectionDelay: 1500,
    timeout: 10_000,
  });

  return socketInstance;
}
