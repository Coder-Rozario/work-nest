// In-memory registry of open SSE connections, grouped by company.
const clients = new Set();

const registerClient = (client) => {
  clients.add(client);
  return () => clients.delete(client);
};

const sendToClient = (client, payload) => {
  try {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    clients.delete(client);
  }
};

// Push an event to every open stream that belongs to the same company.
const broadcastToCompany = (companyId, payload) => {
  clients.forEach((client) => {
    if (Number(client.companyId) === Number(companyId)) {
      sendToClient(client, payload);
    }
  });
};

const connectionCount = () => clients.size;

module.exports = { registerClient, broadcastToCompany, connectionCount };
