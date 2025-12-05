export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { userId, number, message } = req.body;

    // Repassa a requisição para a VPS via Backend (Server-to-Server)
    // O novo server.js usa POST /send/:userId com { groupId, message }
    const response = await fetch(`http://72.60.228.212:3000/send/${userId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: number,
        message: message
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error("Erro proxy SEND:", error);
    return res.status(500).json({ error: "Erro ao conectar com servidor WhatsApp" });
  }
}