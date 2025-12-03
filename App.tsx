import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Logs } from './pages/Logs';

// Simple "Forgot Password" placeholder
const ForgotPassword = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="text-center">
      <h2 className="text-xl font-bold text-slate-900">Recuperação de Senha</h2>
      <p className="mt-2 text-slate-600">Um email de recuperação foi enviado.</p>
      <a href="#/login" className="mt-4 inline-block text-indigo-600 hover:underline">Voltar para Login</a>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="logs" element={<Logs />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
