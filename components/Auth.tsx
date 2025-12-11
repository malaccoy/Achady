import React, { useState } from 'react';
import { login, register } from '../services/api';
import { Lock, Mail, ArrowRight, Loader2, UserPlus, LogIn, AlertCircle } from 'lucide-react';

interface AuthProps {
    onLogin: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
    const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (view === 'login') {
                await login(email, password);
                onLogin();
            } else if (view === 'register') {
                if (password !== confirmPassword) throw new Error('Senhas não conferem');
                const res = await register(email, password, confirmPassword);
                setSuccess(res.message);
                setView('login');
                setPassword(''); setConfirmPassword('');
            } else if (view === 'forgot') {
                // Mock request since API endpoint is implemented in backend but frontend api.ts needs update
                // For now, assuming user will just use login
                setError("Funcionalidade em manutenção. Contate o suporte.");
            }
        } catch (e: any) {
            setError(e.message || 'Erro na autenticação');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        setView('forgot');
    };

    const handleGoToSignup = () => {
        setView('register');
    };

    return (
        <main className="login-page">
            <div className="login-grid">
                <section className="login-card">
                    <div className="login-brand">
                        <h1 className="login-title">ACHADY Bot</h1>
                        <p className="login-subtitle">Automação de Ofertas Shopee</p>
                    </div>

                {error && (
                    <div className="bg-red-900/20 text-red-200 border border-red-900/30 p-3 rounded text-sm mb-6 text-center flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4"/> {error}
                    </div>
                )}
                 {success && (
                    <div className="bg-green-900/20 text-green-200 border border-green-900/30 p-3 rounded text-sm mb-6 text-center">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {view === 'login' && (
                        <>
                            <div className="login-field">
                                <label>Email</label>
                                <input
                                    type="email"
                                    placeholder="seu@email.com"
                                    className="login-input"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="login-field">
                                <label>Senha</label>
                                <input
                                    type="password"
                                    placeholder="Sua senha"
                                    className="login-input"
                                    autoComplete="current-password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>

                            <div className="login-links">
                                <button
                                    type="button"
                                    className="login-link"
                                    onClick={handleForgotPassword}
                                >
                                    Esqueceu a senha?
                                </button>
                            </div>

                            <button type="submit" className="login-button-primary btn-primary" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><LogIn className="w-5 h-5" /> Entrar</>}
                            </button>

                            <p className="login-create">
                                Não tem uma conta?{" "}
                                <button
                                    type="button"
                                    className="login-link"
                                    onClick={handleGoToSignup}
                                >
                                    Criar agora
                                </button>
                            </p>

                            <p className="login-helper">
                                Login seguro. Seus dados são usados apenas para conectar sua conta Shopee.
                            </p>
                        </>
                    )}

                    {view === 'register' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                    <input 
                                        type="email" 
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                    <input 
                                        type="password" 
                                        required
                                        minLength={8}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Confirmar Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                    <input 
                                        type="password" 
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full btn-primary mt-6"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><UserPlus className="w-5 h-5" /> Criar Conta</>}
                            </button>
                        </>
                    )}

                    {view === 'forgot' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                                    <input 
                                        type="email" 
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full btn-primary mt-6"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Recuperar Senha</>}
                            </button>
                        </>
                    )}
                </form>

                    <div className="mt-6 text-center border-t border-slate-700/50 pt-6 flex flex-col gap-2">
                        {view === 'register' && (
                            <button onClick={() => setView('login')} className="text-slate-400 hover:text-white text-sm transition-colors">
                                Já tem conta? <span className="text-orange-400">Fazer login</span>
                            </button>
                        )}
                        
                        {view === 'forgot' && (
                            <button onClick={() => setView('login')} className="text-slate-400 hover:text-white text-sm transition-colors">
                                Voltar para <span className="text-orange-400">Login</span>
                            </button>
                        )}
                    </div>
                </section>

                <section className="login-hero">
                    <h2>Conecte Shopee. Envie ofertas. Escale no WhatsApp.</h2>
                    <p>
                        O ACHADY conecta sua conta de afiliado Shopee e envia automaticamente as
                        melhores ofertas para seus grupos de WhatsApp.
                    </p>
                    <ul>
                        <li>Filtre produtos por palavras-chave.</li>
                        <li>Controle a frequência de envios.</li>
                        <li>Acompanhe status do bot em tempo real.</li>
                    </ul>
                </section>
            </div>
        </main>
    );
};
