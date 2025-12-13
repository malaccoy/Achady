import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Achady',
  description: 'Sistema de automação para ofertas',
};

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-links">
          <a href="/politica-de-privacidade">Política de Privacidade</a>
          <span className="footer-separator">•</span>
          <a href="/termos">Termos</a>
          <span className="footer-separator">•</span>
          <a href="/exclusao-de-dados">Exclusão de Dados</a>
        </div>
        <p className="footer-text">© 2025 Achady. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
