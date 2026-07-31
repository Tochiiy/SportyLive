import { WebSocketServer, WebSocket } from "ws";

/**
 * Reverse index: matchId → Set of sockets subscribed to that match.
 * Enables O(1) targeted broadcasts without iterating all clients.
 */
const matchSubscribers = new Map();

/**
 * Register a socket as a subscriber of a match.
 * Only call after adding the matchId to socket.subscribedMatches.
 */
function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

/**
 * Remove a socket from a match's subscriber set.
 * Deletes the map entry once no subscribers remain.
 */
function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;
  subscribers.delete(socket);
  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

/**
 * Remove a socket from all matches it subscribed to.
 * Called on socket close to prevent memory leaks.
 */
function unsubscribeAll(socket) {
  for (const matchId of socket.subscribedMatches) {
    unsubscribe(matchId, socket);
  }
  socket.subscribedMatches.clear();
}

/**
 * Send a JSON payload to a single socket if it is still open.
 */
function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

/**
 * Send a JSON payload to every subscriber of a specific match.
 */
function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Send a JSON payload to every connected WebSocket client (lobby).
 */
function broadcastAll(wss, payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

/**
 * Attach a WebSocket server to the given HTTP server.
 * Handles connection lifecycle, subscribe/unsubscribe messages, and heartbeats.
 * Returns broadcast helpers for use in route handlers.
 */
export function attachSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.subscribedMatches = new Set();

    sendJson(socket, { type: "welcome" });

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        sendJson(socket, { type: "error", message: "Invalid JSON" });
        return;
      }

      if (!parsed.type) {
        sendJson(socket, { type: "error", message: "Message type required" });
        return;
      }

      if (parsed.type === "subscribe") {
        if (parsed.matchId != null) {
          socket.subscribedMatches.add(parsed.matchId);
          subscribe(parsed.matchId, socket);
          sendJson(socket, { type: "subscribed", matchId: parsed.matchId });
        }
        return;
      }

      if (parsed.type === "unsubscribe") {
        if (parsed.matchId != null) {
          socket.subscribedMatches.delete(parsed.matchId);
          unsubscribe(parsed.matchId, socket);
          sendJson(socket, { type: "unsubscribed", matchId: parsed.matchId });
        }
        return;
      }

      sendJson(socket, { type: "error", message: "Unknown message type" });
    });

    socket.on("error", console.error);

    socket.on("close", () => {
      unsubscribeAll(socket);
    });
  });

  /**
   * Heartbeat interval — pings all clients every 30s and
   * terminates any that fail to respond with a pong.
   */
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30000);

  wss.on("close", () => clearInterval(heartbeat));

  /**
   * Broadcast a newly created match to all connected clients (lobby feed).
   */
  function broadCastMatch(match) {
    broadcastAll(wss, { type: "match_created", data: match });
  }

  /**
   * Broadcast a score update only to clients subscribed to that match.
   * Uses the matchSubscribers index instead of scanning all clients.
   */
  function broadCastScoreUpdate(matchId, match) {
    broadcastToMatch(matchId, { type: "score_updated", data: match });
  }

  return { broadCastMatch, broadCastScoreUpdate, wss };
}
