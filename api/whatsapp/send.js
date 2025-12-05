export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    // Repassa a requisição para a VPS via Backend (Server-to-Server)
    // Isso evita o erro de Mixed Content (HTTPS -> HTTP)
    const response = await fetch("http://72.60.228.212:3000/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error("Erro proxy SEND:", error);
    return res.status(500).json({ error: "Erro ao conectar com servidor WhatsApp" });
  }
}