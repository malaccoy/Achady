export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const response = await fetch("http://72.60.228.212:3000/start/1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro proxy START:", error);
    return res.status(500).json({ error: "Erro ao conectar com servidor WhatsApp" });
  }
}