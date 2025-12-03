import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input, Button, AchadyLogo } from '../components/UI';
import { ArrowRight, Lock } from 'lucide-react';
import { db } from '../services/db';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      const result = db.login(formData.email, formData.password);
      setLoading(false);

      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Credenciais inválidas.');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <AchadyLogo size="lg" />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Acesse seu painel de automação premium
        </p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md">
        <div className="bg-white py-8 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border border-slate-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              label="Email Corporativo"
              type="email"
              placeholder="ex: nome@empresa.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              required
            />

            <div>
              <Input
                label="Senha"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                icon={<Lock className="w-4 h-4" />}
                required
              />
              <div className="flex justify-end mt-2">
                <Link to="/forgot-password" className="text-xs font-medium text-achady-purple hover:text-achady-blue">
                  Esqueceu a senha?
                </Link>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-achady-error text-xs font-medium rounded-lg border border-red-100 flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-achady-error mr-2" />
                {error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" isLoading={loading}>
              Entrar na Plataforma <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-50">
            <div className="text-center text-sm">
              <span className="text-slate-500">Não possui conta? </span>
              <Link to="/register" className="font-semibold text-achady-purple hover:text-achady-blue transition-colors">
                Criar conta grátis
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} ACHADY Inc.
      </p>
    </div>
  );
};