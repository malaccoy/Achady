import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input, Button, AchadyLogo } from '../components/UI';
import { ShieldCheck } from 'lucide-react';
import { db } from '../services/db';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("As senhas não conferem.");
      return;
    }
    
    setLoading(true);
    
    setTimeout(() => {
      const result = db.createUser(formData.email, formData.password);
      setLoading(false);

      if (result.success) {
        db.login(formData.email, formData.password);
        navigate('/');
      } else {
        alert(result.error || "Erro ao criar conta");
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <AchadyLogo size="lg" />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Potencialize seus grupos com automação inteligente
        </p>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white py-8 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl border border-slate-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <Input
              label="Email Profissional"
              type="email"
              placeholder="nome@empresa.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              required
            />

            <Input
              label="Defina uma Senha"
              type="password"
              placeholder="Min. 8 caracteres"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              required
            />

            <Input
              label="Confirme a Senha"
              type="password"
              placeholder="Repita a senha"
              value={formData.confirmPassword}
              onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
              required
            />

            <div className="py-2 flex items-start gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-achady-success shrink-0" />
              <p>Seus dados estão protegidos. Ao registrar, você concorda com nossos Termos de Serviço.</p>
            </div>

            <Button type="submit" fullWidth size="lg" isLoading={loading}>
              Criar Conta Gratuita
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-50 text-center text-sm">
            <span className="text-slate-500">Já possui uma conta? </span>
            <Link to="/login" className="font-semibold text-achady-purple hover:text-achady-blue transition-colors">
              Fazer Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};