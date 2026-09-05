/**
 * Socket.IO Realtime Handler Stub
 * Connects real-time events for live case status updates & notifications
 */
function initSockets(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join case room for live updates
    socket.on('join-case', (caseHashId) => {
      socket.join(`case:${caseHashId}`);
      console.log(`Socket ${socket.id} joined case:${caseHashId}`);
    });

    socket.on('leave-case', (caseHashId) => {
      socket.leave(`case:${caseHashId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

module.exports = initSockets;
