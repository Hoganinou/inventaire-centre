import React, { useState } from 'react';
import { AdminAuthService } from '../firebase/admin-auth-service';
import './AdminLoginModal.css';

interface AdminLoginModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onSuccess, onCancel }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Veuillez saisir le mot de passe');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isValid = await AdminAuthService.verifyPassword(password);
      
      if (isValid) {
        AdminAuthService.setAdminSession();
        setPassword('');
        onSuccess();
      } else {
        setError('Mot de passe incorrect');
      }
    } catch (err) {
      console.error('Erreur authentification admin:', err);
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError('');
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="admin-login-overlay">
      <div className="admin-login-modal">
        <div className="admin-login-header">
          <h2>🔐 Accès Administration</h2>
          <p>Veuillez saisir le mot de passe administrateur</p>
        </div>

        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="password-input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe administrateur"
              className="password-input"
              disabled={loading}
              autoFocus
            />
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <div className="admin-login-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="cancel-btn"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="login-btn"
              disabled={loading || !password.trim()}
            >
              {loading ? (
                <span className="loading-spinner-small">⏳</span>
              ) : (
                '🔓 Se connecter'
              )}
            </button>
          </div>
        </form>


      </div>
    </div>
  );
};

export default AdminLoginModal;