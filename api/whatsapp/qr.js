export default async function handler(req, res) {
  try {
    const response = await fetch("http://72.60.228.212:3000/qr/1");
    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro proxy QR:", error);
    return res.status(500).json({ error: "Erro ao buscar QR" });
  }
}