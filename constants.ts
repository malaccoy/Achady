// In Vite, env vars are exposed via import.meta.env and should usually be prefixed with VITE_
// We check for VITE_API_BASE_URL first, then fallback to NEXT_PUBLIC_API_BASE_URL, then the hardcoded VPS IP.

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.NEXT_PUBLIC_API_BASE_URL ||
  "http://72.60.228.212:3001/api";

export const MOCK_PREVIEW_DATA = {
  titulo: "Fone de Ouvido Bluetooth Sem Fio TWS i12",
  preco: "R$ 29,90",
  precoOriginal: "R$ 89,90",
  desconto: "67%",
  link: "https://shopee.com.br/produto-exemplo"
};